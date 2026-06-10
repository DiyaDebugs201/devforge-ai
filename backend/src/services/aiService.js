/**
 * aiService.js  — Groq Cloud API (replaces HuggingFace)
 *
 * Groq uses an OpenAI-compatible REST API.
 * Models available on free tier:
 *   - llama-3.3-70b-versatile  (best quality, generous free limits)
 *   - llama-3.1-8b-instant     (fastest, lowest latency)
 *   - mixtral-8x7b-32768       (good for long contexts like large diffs)
 *   - gemma2-9b-it             (Google's Gemma 2)
 *
 * Free tier limits (as of 2025):
 *   llama-3.3-70b-versatile: 1,000 RPD, 6,000 RPM, 131,072 TPM
 *   llama-3.1-8b-instant:    14,400 RPD, 30,000 RPM, 1,000,000 TPM
 *
 * Env vars required:
 *   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
 *   GROQ_MODEL=llama-3.3-70b-versatile        (optional, defaults below)
 */

require('dotenv').config();
const fetch = require('node-fetch');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS    = 30000;   // Groq is fast — 30s is generous
const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 1000;

// ── helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeError(message, statusCode = 503) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// ── core caller ───────────────────────────────────────────────────────────
/**
 * callAI — sends a chat-completions request to Groq with retry + backoff.
 *
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {object} options
 * @param {string}  options.model          – override model per call
 * @param {number}  options.maxTokens      – max output tokens (default 1024)
 * @param {number}  options.temperature    – 0-2 (default 0.3 for structured output)
 * @param {number}  options.topP           – nucleus sampling (default 0.9)
 * @returns {string} generated text (trimmed)
 */
async function callAI(messages, options = {}) {
  const {
    model       = DEFAULT_MODEL,
    maxTokens   = 1024,
    temperature = 0.3,
    topP        = 0.9,
  } = options;

  if (!process.env.GROQ_API_KEY) {
    throw makeError('GROQ_API_KEY environment variable is not set.', 500);
  }

  const body = {
    model,
    messages,
    max_tokens:  maxTokens,
    temperature,
    top_p:       topP,
    stream:      false,
    // Groq supports response_format for JSON mode — use it for reliability:
    response_format: options.jsonMode
      ? { type: 'json_object' }
      : { type: 'text' },
  };

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      console.log(`🤖 Groq API call — model: ${model}, attempt ${attempt}/${MAX_RETRIES}`);

      const response = await fetch(GROQ_API_URL, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body:   JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      // ── rate limited ──────────────────────────────────────────────
      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('retry-after') || '5',
          10
        );
        console.warn(`⚠️  Groq rate limited — waiting ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }

      // ── server error — retry ──────────────────────────────────────
      if (response.status >= 500) {
        const text = await response.text().catch(() => 'unknown');
        lastError = makeError(`Groq server error ${response.status}: ${text}`);
        throw lastError;
      }

      // ── auth / bad request — do NOT retry ─────────────────────────
      if (response.status === 401) {
        throw makeError('Invalid GROQ_API_KEY. Check your environment variable.', 401);
      }
      if (response.status === 400) {
        const errBody = await response.json().catch(() => ({}));
        throw makeError(
          `Groq bad request: ${errBody?.error?.message || 'unknown'}`,
          400
        );
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw makeError(`Groq API error ${response.status}: ${errBody}`);
      }

      // ── success ───────────────────────────────────────────────────
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw makeError('Groq returned empty content in choices[0].message.content');
      }

      const usage = data?.usage;
      if (usage) {
        console.log(
          `✅ Groq success — ${usage.prompt_tokens} prompt + ` +
          `${usage.completion_tokens} completion tokens`
        );
      }

      return content.trim();

    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      // Don't retry on definitive errors
      if (err.statusCode === 401 || err.statusCode === 400) throw err;

      if (err.name === 'AbortError') {
        console.error(`⏰ Groq call timed out after ${TIMEOUT_MS}ms (attempt ${attempt})`);
        lastError = makeError(`AI request timed out after ${TIMEOUT_MS / 1000}s`);
      } else {
        console.error(`❌ Groq call failed (attempt ${attempt}): ${err.message}`);
      }

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.log(`⏳ Retrying in ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  throw makeError(
    `AI generation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    503
  );
}

// ── JSON extraction helper ────────────────────────────────────────────────
/**
 * Safely parse JSON from AI output.
 * Handles: pure JSON, JSON wrapped in ```json fences, JSON embedded in prose.
 */
function extractJSON(text) {
  // 1. Try direct parse first (Groq json_object mode usually gives clean output)
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // 2. Strip ```json ... ``` fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) { /* fall through */ }
  }

  // 3. Extract first JSON object {...}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (_) { /* fall through */ }
  }

  // 4. Extract first JSON array [...]
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (_) { /* fall through */ }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL-SPECIFIC AI FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// ── BranchNamer ───────────────────────────────────────────────────────────
async function generateBranchNames(taskDescription, ticketId = '', config = {}) {
  const {
    prefixes  = ['feature', 'fix', 'chore', 'hotfix', 'refactor'],
    maxLength = 60,
  } = config;

  const ticketPart = ticketId ? `Ticket ID: ${ticketId}\n` : '';

  const messages = [
    {
      role: 'system',
      content: `You are a Git branch naming expert. Generate clean, semantic Git branch names.

STRICT RULES:
- Use ONLY lowercase letters, numbers, and hyphens
- NO spaces, NO special characters except hyphens and forward slashes
- Maximum ${maxLength} characters per full branch name (including prefix)
- Each branch MUST start with one of: ${prefixes.join(', ')}
- Format: prefix/TICKET-description-words  OR  prefix/description-words
- If ticket ID provided: place it immediately after the prefix slash
- Description words: 3-6 words max, hyphen-separated, describing the change
- Generate exactly 5 DIFFERENT branches, each with a DIFFERENT prefix
- No duplicate names

RESPONSE FORMAT — return ONLY a valid JSON array, no other text, no markdown:
[
  {"prefix":"feature","name":"feature/PROJ-123-add-oauth-login","command":"git checkout -b feature/PROJ-123-add-oauth-login"},
  {"prefix":"fix","name":"fix/PROJ-123-resolve-auth-redirect","command":"git checkout -b fix/PROJ-123-resolve-auth-redirect"},
  {"prefix":"chore","name":"chore/PROJ-123-update-auth-deps","command":"git checkout -b chore/PROJ-123-update-auth-deps"},
  {"prefix":"refactor","name":"refactor/PROJ-123-simplify-login-flow","command":"git checkout -b refactor/PROJ-123-simplify-login-flow"},
  {"prefix":"hotfix","name":"hotfix/PROJ-123-patch-session-leak","command":"git checkout -b hotfix/PROJ-123-patch-session-leak"}
]`,
    },
    {
      role: 'user',
      content: `${ticketPart}Task description: ${taskDescription}

Generate 5 branch name options using prefixes: ${prefixes.join(', ')}`,
    },
  ];

  return callAI(messages, {
    maxTokens:   600,
    temperature: 0.3,
    jsonMode:    false, // array not object — can't use json_object mode
  });
}

// ── TestCraft ─────────────────────────────────────────────────────────────
async function generateTests(functionCode, language = 'javascript') {
  const messages = [
    {
      role: 'system',
      content: `You are a senior ${language === 'typescript' ? 'TypeScript' : 'JavaScript'} engineer specializing in test-driven development with Jest.

Generate a COMPLETE, RUNNABLE Jest test file for the provided function.

REQUIREMENTS:
- Write real Jest test code using describe(), it()/test(), expect() — no pseudocode
- Cover ALL categories:
  1. happy-path: valid inputs that should succeed
  2. edge-case: null, undefined, empty string, empty array, zero values
  3. boundary: min/max values, exact limits
  4. error: invalid types, out-of-range, expected throws (use expect(...).toThrow())
- Each test name MUST clearly describe WHAT is tested AND what result is expected
- Use beforeEach/afterEach if the function has side effects
- Add a brief comment above each describe block explaining the test group
- The fullTestFile must be a COMPLETE, syntactically valid Jest file a developer can run immediately

RESPONSE FORMAT — return ONLY a valid JSON object, no markdown fences:
{
  "functionName": "extracted function name here",
  "importStatement": "const { functionName } = require('./functionName');",
  "fullTestFile": "COMPLETE jest file as a single string with real \\n newlines — must include import, describe blocks, and all test cases",
  "testCases": [
    {
      "name": "should return correct result when given valid inputs",
      "category": "happy-path",
      "code": "it('should return correct result when given valid inputs', () => {\\n  expect(fn(1, 2)).toBe(3);\\n});"
    }
  ],
  "estimatedCoverage": 85
}

CRITICAL: fullTestFile must be the COMPLETE jest file — not a placeholder, not a summary. Include every single test case in it. Use \\n for newlines within the string.`,
    },
    {
      role: 'user',
      content: `Generate a complete Jest test suite for this ${language} function:\n\n${functionCode}`,
    },
  ];

  return callAI(messages, {
    maxTokens:   3000,  // tests can be long
    temperature: 0.2,   // low temp = consistent, correct code
    jsonMode:    true,  // Groq json_object mode for reliable parsing
  });
}

// ── PR Describer ──────────────────────────────────────────────────────────
async function generatePRDescription(diffOrContent, mode = 'concise') {
  const detailInstruction = mode === 'detailed'
    ? 'Be THOROUGH. Include technical details, potential risks, performance implications, and architectural decisions. Each section should be 3-5 sentences minimum.'
    : 'Be CONCISE. Each section should be 1-3 sentences. Developers should grasp the change in under 60 seconds.';

  const messages = [
    {
      role: 'system',
      content: `You are a senior engineering lead who writes exceptional pull request descriptions that reviewers love.

${detailInstruction}

RESPONSE FORMAT — return ONLY a valid JSON object, no markdown fences:
{
  "title": "Imperative PR title under 72 chars (e.g. 'Fix: resolve login redirect loop for OAuth users')",
  "summary": "2-3 sentence overview of the change and its purpose",
  "whatChanged": "Specific description of code changes made",
  "whyChanged": "Business or technical reason driving this change",
  "testingSteps": "Numbered steps for a reviewer to verify the change works\\n1. Step one\\n2. Step two",
  "reviewerChecklist": [
    "Checked for edge cases in the changed logic",
    "Verified no breaking changes to existing API contracts",
    "Confirmed tests cover the new behavior",
    "Checked for security implications",
    "Verified logging is appropriate"
  ],
  "markdownFull": "## PR Title\\n\\n### Summary\\n...complete GitHub-ready markdown...",
  "plainTextFull": "PR TITLE\\n\\nSUMMARY\\n...complete plain text version..."
}

The markdownFull field must be a COMPLETE, copy-paste-ready GitHub PR description using proper ## headings.`,
    },
    {
      role: 'user',
      content: `Generate a structured PR description for the following:\n\n${diffOrContent}`,
    },
  ];

  return callAI(messages, {
    maxTokens:   2000,
    temperature: 0.3,
    jsonMode:    true,
  });
}

module.exports = {
  callAI,
  extractJSON,
  generateBranchNames,
  generateTests,
  generatePRDescription,
};
