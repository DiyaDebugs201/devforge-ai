const { validationResult }          = require('express-validator');
const { generatePRDescription, extractJSON } = require('../services/aiService');
const PRHistory                     = require('../models/PRHistory');
const { asyncHandler }              = require('../middleware/errorHandler');

// ── GitHub URL validation (relaxed) ──────────────────────────────────────
/**
 * Accept any github.com URL that looks like a PR.
 * Also accept generic GitHub URLs — the AI will describe based on context.
 *
 * Accepted patterns:
 *   https://github.com/owner/repo/pull/123
 *   https://github.com/owner/repo/pull/123#issuecomment-xxx
 *   https://www.github.com/owner/repo/pull/123
 *   https://github.com/owner/repo  (no PR number — describe the repo change)
 */
function isGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    // Accept github.com and www.github.com
    return (
      (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com') &&
      parsed.protocol === 'https:'
    );
  } catch {
    return false;
  }
}

function isGitHubPRUrl(url) {
  return /https?:\/\/(?:www\.)?github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);
}

// ── build fallback markdown ───────────────────────────────────────────────
function buildMarkdown(d) {
  const checklist = (d.reviewerChecklist || [])
    .map((item) => `- [ ] ${item}`)
    .join('\n');
  return `## ${d.title}

### Summary
${d.summary}

### What Changed
${d.whatChanged}

### Why This Change
${d.whyChanged}

### Testing Steps
${d.testingSteps}

### Reviewer Checklist
${checklist}`;
}

function buildPlainText(d) {
  const checklist = (d.reviewerChecklist || [])
    .map((item) => `☐ ${item}`)
    .join('\n');
  return `${d.title}

SUMMARY
${d.summary}

WHAT CHANGED
${d.whatChanged}

WHY
${d.whyChanged}

TESTING STEPS
${d.testingSteps}

REVIEWER CHECKLIST
${checklist}`;
}

// ── POST /api/pr/generate ─────────────────────────────────────────────────
const generatePR = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { rawDiff, prUrl, mode = 'concise' } = req.body;

  // ── determine input ──────────────────────────────────────────────
  let inputType;
  let contentToAnalyze;

  if (prUrl && prUrl.trim()) {
    const trimmedUrl = prUrl.trim();

    // Validate it is a GitHub URL (relaxed — any github.com URL accepted)
    if (!isGitHubUrl(trimmedUrl)) {
      return res.status(400).json({
        success: false,
        message:
          'Only GitHub URLs are supported (https://github.com/...). ' +
          'For GitLab or Bitbucket PRs, please paste the git diff instead.',
      });
    }

    inputType = 'url';

    // Tell the AI what we know about the URL
    const isPR = isGitHubPRUrl(trimmedUrl);
    contentToAnalyze = isPR
      ? `GitHub Pull Request URL: ${trimmedUrl}\n\nPlease generate a comprehensive PR description based on the PR URL above. Infer the likely changes, purpose, and context from the repository name and PR number. Generate realistic, professional content that matches what such a PR might contain.`
      : `GitHub URL: ${trimmedUrl}\n\nPlease generate a pull request description for changes related to this GitHub repository. Infer the likely purpose and generate a professional PR description template based on the repository name and context.`;

  } else if (rawDiff && rawDiff.trim()) {
    const trimmedDiff = rawDiff.trim();

    if (trimmedDiff.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Git diff is too short. Please paste a valid git diff.',
      });
    }

    inputType = 'diff';
    // Truncate very long diffs to avoid token limits (keep first 12,000 chars)
    contentToAnalyze =
      trimmedDiff.length > 12000
        ? trimmedDiff.substring(0, 12000) + '\n\n... [diff truncated for length]'
        : trimmedDiff;

  } else {
    return res.status(400).json({
      success: false,
      message: 'Please provide either a rawDiff (git diff output) or a prUrl (GitHub URL).',
    });
  }

  // ── call AI ──────────────────────────────────────────────────────
  const rawResponse = await generatePRDescription(contentToAnalyze, mode);

  // ── parse AI output ───────────────────────────────────────────────
  let parsed = null;
  try {
    parsed = typeof rawResponse === 'string'
      ? extractJSON(rawResponse)
      : rawResponse;
  } catch (parseErr) {
    console.error('PR JSON parse error:', parseErr.message);
  }

  // ── build output ──────────────────────────────────────────────────
  let output;

  if (parsed && typeof parsed === 'object') {
    const reviewerChecklist = Array.isArray(parsed.reviewerChecklist)
      ? parsed.reviewerChecklist.filter((i) => typeof i === 'string')
      : [
          'Checked for edge cases',
          'Verified no breaking changes',
          'Confirmed tests pass',
          'Reviewed for security implications',
          'Checked logging is appropriate',
        ];

    const base = {
      title:             String(parsed.title             || 'Pull Request'),
      summary:           String(parsed.summary           || ''),
      whatChanged:       String(parsed.whatChanged       || ''),
      whyChanged:        String(parsed.whyChanged        || ''),
      testingSteps:      String(parsed.testingSteps      || ''),
      reviewerChecklist,
    };

    output = {
      ...base,
      markdownFull:  (typeof parsed.markdownFull === 'string' && parsed.markdownFull.trim().length > 20)
        ? parsed.markdownFull
        : buildMarkdown(base),
      plainTextFull: (typeof parsed.plainTextFull === 'string' && parsed.plainTextFull.trim().length > 20)
        ? parsed.plainTextFull
        : buildPlainText(base),
    };
  } else {
    // Fallback — use raw response text
    const fallbackTitle = 'Generated PR Description';
    const base = {
      title:             fallbackTitle,
      summary:           typeof rawResponse === 'string' ? rawResponse.substring(0, 500) : '',
      whatChanged:       '',
      whyChanged:        '',
      testingSteps:      '',
      reviewerChecklist: [],
    };
    output = {
      ...base,
      markdownFull:  typeof rawResponse === 'string' ? rawResponse : buildMarkdown(base),
      plainTextFull: typeof rawResponse === 'string' ? rawResponse : buildPlainText(base),
    };
  }

  // ── save to DB ────────────────────────────────────────────────────
  let historyEntry;
  try {
    historyEntry = await PRHistory.create({
      userId: req.user._id,
      input:  {
        type:    inputType,
        rawDiff: rawDiff || '',
        prUrl:   prUrl   || '',
      },
      output,
      mode,
    });
  } catch (dbErr) {
    console.error('Failed to save PRHistory:', dbErr.message);
  }

  return res.status(200).json({
    success: true,
    data: {
      ...output,
      mode,
      historyId: historyEntry?._id || null,
    },
  });
});

module.exports = { generatePR };
