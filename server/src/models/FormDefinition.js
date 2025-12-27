const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema(
  { label: String, value: String },
  { _id: false }
);

// ✅ Matrix için satır/sütun şemaları
const MatrixRowSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },   // örn: "kamera"
    label: { type: String, required: true, trim: true }, // örn: "Kamera"
  },
  { _id: false }
);

const MatrixColSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },       // örn: "var"
    label: { type: String, required: true, trim: true },     // örn: "Var"
    subLabel: { type: String, trim: true },                  // opsiyonel: "Çalışıyor"
  },
  { _id: false }
);

const FieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },           // örn: "city"
    label: { type: String, required: true },         // örn: "Şehir"
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

    // varsayılan değer
    defaultValue: mongoose.Schema.Types.Mixed,

    // ✅ matrix için (sadece type="matrix" iken kullanılır)
    matrix: {
      rows: { type: [MatrixRowSchema], default: [] },
      cols: { type: [MatrixColSchema], default: [] },

      // opsiyonel: tek seçim mi çok seçim mi, vb.
      // mode: { type: String, enum: ["single", "multi"], default: "single" },
    },
  },
  { _id: false }
);

const FormDefinitionSchema = new mongoose.Schema(
  {
    pageKey: { type: String, required: true, unique: true, index: true }, // "site-create"
    title: { type: String, default: "" },
    fields: { type: [FieldSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FormDefinition", FormDefinitionSchema);
