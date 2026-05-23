const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    dosage: {
      type: String,
      required: true,
    },
    frequency: {
      type: String,
      required: true,
    },
    duration: {
      type: String,
      required: true,
    },
    instructions: String,
    quantity: Number,
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    medications: {
      type: [medicationSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one medication required",
      },
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    notes: String,
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    refillsAllowed: {
      type: Number,
      default: 0,
    },
    refillsUsed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

prescriptionSchema.index({ patient: 1, issuedAt: -1 });
prescriptionSchema.index({ doctor: 1, issuedAt: -1 });
prescriptionSchema.index({ appointment: 1 });

prescriptionSchema.virtual("isExpired").get(function isExpired() {
  return Date.now() > new Date(this.validUntil).getTime();
});

module.exports = mongoose.model("Prescription", prescriptionSchema);
