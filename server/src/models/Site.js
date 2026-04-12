const mongoose = require("mongoose");

const SiteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "", trim: true },
    logoUrl: { type: String, default: "", trim: true },

    // ✅ SiteCreate ekranındaki dinamik alanlar buraya giriyor
    dynamic: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Siteye ait personeller
    personnel: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true, trim: true },
            role: { type: String, default: "", trim: true },
            phone: { type: String, default: "", trim: true },
            email: { type: String, default: "", trim: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    notificationRecipients: {
      type: [
        new mongoose.Schema(
          {
            email: { type: String, required: true, trim: true, lowercase: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Site", SiteSchema);
