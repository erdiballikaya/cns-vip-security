const mongoose = require("mongoose");


const OptionSchema = new mongoose.Schema(
  { label: String, value: String },
  { _id: false }
);


// ✅ matrix için
const MatrixColumnSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    subLabel: { type: String },
  },
  { _id: false }
);

const MatrixRowSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false }
);


const FieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },

    // ✅ BURASI: enum’a matrix eklenecek
    type: {
      type: String,
      enum: ["text", "number", "boolean", "select", "image", "matrix"],
      required: true,
    },

    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },

    // number için
    min: Number,
    max: Number,

    // select için
    options: { type: [OptionSchema], default: [] },

    // ✅ matrix için
    columns: { type: [MatrixColumnSchema], default: undefined },
    rows: { type: [MatrixRowSchema], default: undefined },

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
    description: { type: String, default: "" },
    fields: { type: [FieldSchema], default: [] },
    recipients: { type: Array, default: [] }, // sende nasıl ise
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormTemplate", FormTemplateSchema);
