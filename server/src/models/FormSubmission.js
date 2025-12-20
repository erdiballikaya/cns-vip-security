const mongoose = require("mongoose");

const MailLogSchema = new mongoose.Schema(
  {
    to: String,
    ok: Boolean,
    at: Date,
    error: String,
  },
  { _id: false }
);

const FormSubmissionSchema = new mongoose.Schema(
  {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "FormTemplate", required: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site", required: true },

    values: { type: Object, default: {} }, // { fieldKey: value(url dahil) }
    status: { type: String, enum: ["DRAFT", "COMPLETED"], default: "DRAFT" },

    pdfPath: String,
    mailLog: { type: [MailLogSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormSubmission", FormSubmissionSchema);
