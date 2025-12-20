const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "MANAGER", "PERSONNEL"], default: "PERSONNEL" },
    enabledModules: { type: [String], default: [] },
  },
  { timestamps: true }
);

  mongoose.connection.on('connected', () => {
    console.log('Mongoose bağlandı.');
  });

  mongoose.connection.on('error', (err) => {
    console.log('Mongoose bağlantı hatası: ' + err);
  });

module.exports = mongoose.models.User || mongoose.model("User", UserSchema);
