const { validationResult }          = require('express-validator');
const { generateBranchNames, extractJSON } = require('../services/aiService');
const BranchHistory                 = require('../models/BranchHistory');
const { asyncHandler }              = require('../middleware/errorHandler');

// ── validate & clean a single branch name ────────────────────────────────
function validateBranchName(name = '', maxLength = 60) {
  const errors = [];
  // Normalise: lowercase, replace spaces/underscores with hyphens, strip bad chars
  let cleaned = name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-\/]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-\/]+|[-\/]+$/g, '');

  if (!cleaned)          errors.push('Branch name is empty after cleaning');
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    errors.push(`Trimmed to ${maxLength} characters`);
  }

  return { valid: errors.length === 0, errors, cleaned };
}

// ── POST /api/branch/generate ─────────────────────────────────────────────
const generateBranch = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { taskDescription, ticketId } = req.body;
  const config = req.user.branchConfig || {};

  // ── call AI ──────────────────────────────────────────────────────
  const rawResponse = await generateBranchNames(
    taskDescription.trim(),
    ticketId?.trim() || '',
    config
  );

  // ── parse ─────────────────────────────────────────────────────────
  let parsed = extractJSON(rawResponse);

  // If the top-level result is an object with a branches key, unwrap it
  if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.branches)) {
    parsed = parsed.branches;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('Branch parse failed. Raw:', rawResponse?.substring(0, 400));
    return res.status(502).json({
      success: false,
      message: 'AI returned an unexpected format. Please try again.',
    });
  }

  // ── validate each branch ──────────────────────────────────────────
  const maxLen = config.maxLength || 60;
  const branches = parsed.slice(0, 5).map((item) => {
    const rawName  = String(item.name || item.branch || '');
    const prefix   = String(item.prefix || rawName.split('/')[0] || 'feature');
    const { valid, errors: valErrors, cleaned } = validateBranchName(rawName, maxLen);
    const finalName = cleaned || rawName;
    return {
      name:             finalName,
      prefix,
      fullCommand:      `git checkout -b ${finalName}`,
      valid,
      validationErrors: valErrors,
    };
  });

  // ── save to DB ────────────────────────────────────────────────────
  let historyEntry;
  try {
    historyEntry = await BranchHistory.create({
      userId: req.user._id,
      input:  { taskDescription: taskDescription.trim(), ticketId: ticketId?.trim() || '' },
      branches,
    });
  } catch (dbErr) {
    console.error('Failed to save BranchHistory:', dbErr.message);
  }

  return res.status(200).json({
    success: true,
    data: {
      branches,
      historyId: historyEntry?._id || null,
      input: { taskDescription, ticketId },
    },
  });
});

module.exports = { generateBranch, validateBranchName };
