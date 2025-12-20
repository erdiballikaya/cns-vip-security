const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "boolean", "select", "image"], required: true },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    min: { type: Number },
    max: { type: Number },
    options: [{ label: String, value: String }],
    defaultValue: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const PageSchemaSchema = new mongoose.Schema(
  {
    pageKey: { type: String, required: true, unique: true, index: true }, // "site-create"
    title: { type: String, default: "" },
    fields: { type: [FieldSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PageSchema", PageSchemaSchema);
