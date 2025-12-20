const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema(
    { label: String, value: String },
    { _id: false }
);

const FieldSchema = new mongoose.Schema(
    {
        key: { type: String, required: true },                // örn: "city"
        label: { type: String, required: true },              // örn: "Şehir"
        type: {
            type: String,
            enum: ["text", "number", "boolean", "select", "image"],
            required: true
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
