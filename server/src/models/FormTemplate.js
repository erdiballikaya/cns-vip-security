const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "boolean", "select", "image"], required: true },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    min: Number,
    max: Number,
    options: [{ label: String, value: String }],
    defaultValue: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const RecipientSchema = new mongoose.Schema(
  { email: { type: String, required: true } },
  { _id: false }
);

const FormTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    fields: { type: [FieldSchema], default: [] },
    recipients: { type: [RecipientSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormTemplate", FormTemplateSchema);
