const mongoose = require("mongoose");

const MailLogSchema = new mongoose.Schema(
  {
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "FormSubmission" },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "FormTemplate" },
    templateName: { type: String, default: "" },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site" },
    siteName: { type: String, default: "" },
    to: { type: String, required: true, trim: true, lowercase: true },
    ok: { type: Boolean, required: true },
    error: { type: String, default: "" },
    subject: { type: String, default: "" },
    mode: { type: String, enum: ["bulk", "manual"], default: "bulk" },
    pdfPath: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MailLogSchema.index({ createdAt: -1 });
MailLogSchema.index({ ok: 1, createdAt: -1 });
MailLogSchema.index({ submissionId: 1, createdAt: -1 });
MailLogSchema.index({ siteId: 1, createdAt: -1 });
MailLogSchema.index({ templateId: 1, createdAt: -1 });

module.exports = mongoose.model("MailLog", MailLogSchema);
