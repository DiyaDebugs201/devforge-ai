const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const branchConfigSchema = new mongoose.Schema({
  prefixes: {
    type: [String],
    default: ['feature', 'fix', 'chore', 'hotfix', 'refactor'],
  },
  ticketPrefix: { type: String, default: '' },
  separator: { type: String, default: '-', enum: ['-', '_', '/'] },
  maxLength: { type: Number, default: 60 },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // Daily AI usage tracking
    dailyUsage: {
      count: { type: Number, default: 0 },
      date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    },
    // Per-tool usage stats
    usageStats: {
      branch: { type: Number, default: 0 },
      tests: { type: Number, default: 0 },
      pr: { type: Number, default: 0 },
    },
    branchConfig: {
      type: branchConfigSchema,
      default: () => ({}),
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Reset daily usage if date has changed
userSchema.methods.checkAndResetDailyUsage = async function () {
  const today = new Date().toISOString().split('T')[0];
  if (this.dailyUsage.date !== today) {
    this.dailyUsage.count = 0;
    this.dailyUsage.date = today;
    await this.save();
  }
};

// Virtual: total usage
userSchema.virtual('totalUsage').get(function () {
  return (this.usageStats?.branch || 0) + (this.usageStats?.tests || 0) + (this.usageStats?.pr || 0);
});

module.exports = mongoose.model('User', userSchema);
