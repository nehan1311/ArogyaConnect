const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const User = require("../models/User");
const emailService = require("./emailService");
const smsService = require("./smsService");

const pad = (value) => value.toString().padStart(2, "0");

const formatDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildDateTime = (dateValue, timeString) =>
  new Date(`${formatDate(dateValue)}T${timeString}:00`);

const buildReminderType = (type) =>
  type === "1HR" ? "APPOINTMENT_REMINDER_1HR" : "APPOINTMENT_REMINDER_15MIN";

const htmlToText = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const buildMedicationSummary = (prescription) => {
  if (Array.isArray(prescription.medications) && prescription.medications.length > 0) {
    return prescription.medications
      .map((medication) => {
        const details = [
          medication.name,
          medication.dosage,
          medication.frequency,
          medication.duration,
        ].filter(Boolean);
        return details.join(" - ");
      })
      .join("<br />");
  }

  return [
    prescription.medicationName,
    prescription.dosage,
    prescription.frequency,
    prescription.duration,
  ]
    .filter(Boolean)
    .join(" - ");
};

const ensureAppointmentPopulated = async (appointment) => {
  const patientPopulated =
    appointment &&
    appointment.patient &&
    typeof appointment.patient === "object" &&
    appointment.patient.email;
  const doctorPopulated =
    appointment &&
    appointment.doctor &&
    typeof appointment.doctor === "object" &&
    appointment.doctor.email;

  if (patientPopulated && doctorPopulated) {
    return appointment;
  }

  return Appointment.findById(appointment._id)
    .populate("patient", "name email profile.phone")
    .populate("doctor", "name email profile.phone");
};

const saveNotificationLog = async ({
  recipientId,
  type,
  channel,
  subject,
  message,
  status,
  errorMessage,
  relatedAppointment,
}) => {
  try {
    if (!recipientId) {
      return null;
    }

    return await Notification.create({
      recipient: recipientId,
      type,
      channel,
      subject,
      message,
      status,
      errorMessage,
      relatedAppointment,
    });
  } catch (error) {
    return null;
  }
};

const dispatchEmail = async ({
  user,
  subject,
  html,
  type,
  relatedAppointmentId,
}) => {
  const message = htmlToText(html);

  if (!user || !user._id || !user.email) {
    await saveNotificationLog({
      recipientId: user && user._id,
      type,
      channel: "EMAIL",
      subject,
      message,
      status: "FAILED",
      errorMessage: "Recipient email not available",
      relatedAppointment: relatedAppointmentId,
    });
    return;
  }

  if (!emailService.isEmailConfigured()) {
    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "EMAIL",
      subject,
      message,
      status: "PENDING",
      errorMessage: "Email not configured — skipped in prototype mode",
      relatedAppointment: relatedAppointmentId,
    });
    return;
  }

  try {
    await emailService.sendEmail({
      to: user.email,
      subject,
      html,
    });

    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "EMAIL",
      subject,
      message,
      status: "SENT",
      relatedAppointment: relatedAppointmentId,
    });
  } catch (error) {
    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "EMAIL",
      subject,
      message,
      status: "FAILED",
      errorMessage: error.message,
      relatedAppointment: relatedAppointmentId,
    });
  }
};

const dispatchSMS = async ({ user, message, type, relatedAppointmentId }) => {
  const phone = user && user.profile && user.profile.phone;

  if (!user || !user._id) {
    return;
  }

  if (!phone) {
    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "SMS",
      message,
      status: "FAILED",
      errorMessage: "Recipient phone not available",
      relatedAppointment: relatedAppointmentId,
    });
    return;
  }

  if (!smsService.isSMSConfigured()) {
    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "SMS",
      message,
      status: "PENDING",
      errorMessage: "SMS not configured — skipped in prototype mode",
      relatedAppointment: relatedAppointmentId,
    });
    return;
  }

  try {
    await smsService.sendSMS({
      to: phone,
      message,
    });

    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "SMS",
      message,
      status: "SENT",
      relatedAppointment: relatedAppointmentId,
    });
  } catch (error) {
    await saveNotificationLog({
      recipientId: user._id,
      type,
      channel: "SMS",
      message,
      status: "FAILED",
      errorMessage: error.message,
      relatedAppointment: relatedAppointmentId,
    });
  }
};

const sendAppointmentConfirmation = async (appointment) => {
  try {
    const populatedAppointment = await ensureAppointmentPopulated(appointment);
    const appointmentDate = formatDate(populatedAppointment.date);
    const patient = populatedAppointment.patient;
    const doctor = populatedAppointment.doctor;

    await dispatchEmail({
      user: patient,
      subject: "Appointment Confirmed",
      html: `
        <div>
          <h2>Appointment Confirmed</h2>
          <p>Doctor: Dr. ${doctor.name}</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${populatedAppointment.startTime} - ${populatedAppointment.endTime}</p>
          <p>Notes: ${populatedAppointment.notes || "N/A"}</p>
        </div>
      `,
      type: "APPOINTMENT_CONFIRMATION",
      relatedAppointmentId: populatedAppointment._id,
    });

    await dispatchSMS({
      user: patient,
      message: `Your appointment with Dr. ${doctor.name} on ${appointmentDate} at ${populatedAppointment.startTime} is confirmed.`,
      type: "APPOINTMENT_CONFIRMATION",
      relatedAppointmentId: populatedAppointment._id,
    });

    await dispatchEmail({
      user: doctor,
      subject: "New Appointment Booked",
      html: `
        <div>
          <h2>New Appointment Booked</h2>
          <p>Patient: ${patient.name}</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${populatedAppointment.startTime} - ${populatedAppointment.endTime}</p>
          <p>Notes: ${populatedAppointment.notes || "N/A"}</p>
        </div>
      `,
      type: "APPOINTMENT_CONFIRMATION",
      relatedAppointmentId: populatedAppointment._id,
    });
  } catch (error) {
  }
};

const sendCancellationNotice = async (appointment) => {
  try {
    const populatedAppointment = await ensureAppointmentPopulated(appointment);
    const appointmentDate = formatDate(populatedAppointment.date);
    const cancellerName =
      populatedAppointment.cancelledBy &&
      populatedAppointment.cancelledBy.toString() === populatedAppointment.patient._id.toString()
        ? populatedAppointment.patient.name
        : populatedAppointment.cancelledBy &&
            populatedAppointment.cancelledBy.toString() === populatedAppointment.doctor._id.toString()
          ? `Dr. ${populatedAppointment.doctor.name}`
          : "an admin";

    const html = `
      <div>
        <h2>Appointment Cancelled</h2>
        <p>Cancelled by: ${cancellerName}</p>
        <p>Date: ${appointmentDate}</p>
        <p>Time: ${populatedAppointment.startTime} - ${populatedAppointment.endTime}</p>
        <p>Reason: ${populatedAppointment.cancellationReason || "Not provided"}</p>
      </div>
    `;

    await dispatchEmail({
      user: populatedAppointment.patient,
      subject: "Appointment Cancelled",
      html,
      type: "APPOINTMENT_CANCELLATION",
      relatedAppointmentId: populatedAppointment._id,
    });

    await dispatchEmail({
      user: populatedAppointment.doctor,
      subject: "Appointment Cancelled",
      html,
      type: "APPOINTMENT_CANCELLATION",
      relatedAppointmentId: populatedAppointment._id,
    });

    await dispatchSMS({
      user: populatedAppointment.patient,
      message: `Your appointment on ${appointmentDate} at ${populatedAppointment.startTime} has been cancelled.`,
      type: "APPOINTMENT_CANCELLATION",
      relatedAppointmentId: populatedAppointment._id,
    });
  } catch (error) {
  }
};

const sendAppointmentReminder = async (appointment, type) => {
  try {
    const populatedAppointment = await ensureAppointmentPopulated(appointment);
    const reminderType = buildReminderType(type);
    const patient = populatedAppointment.patient;
    const doctor = populatedAppointment.doctor;
    const appointmentDate = formatDate(populatedAppointment.date);
    const reminderMessage =
      type === "1HR"
        ? `Reminder: Your appointment with Dr. ${doctor.name} is in 1 hour at ${populatedAppointment.startTime}.`
        : `Reminder: Your appointment with Dr. ${doctor.name} starts in 15 minutes!`;

    await dispatchEmail({
      user: patient,
      subject: "Appointment Reminder",
      html: `
        <div>
          <h2>Appointment Reminder</h2>
          <p>${reminderMessage}</p>
          <p>Date: ${appointmentDate}</p>
          <p>Time: ${populatedAppointment.startTime} - ${populatedAppointment.endTime}</p>
        </div>
      `,
      type: reminderType,
      relatedAppointmentId: populatedAppointment._id,
    });

    await dispatchSMS({
      user: patient,
      message: reminderMessage,
      type: reminderType,
      relatedAppointmentId: populatedAppointment._id,
    });

    if (type === "1HR") {
      populatedAppointment.reminderSent.oneHour = true;
    }

    if (type === "15MIN") {
      populatedAppointment.reminderSent.fifteenMin = true;
    }

    await populatedAppointment.save();
  } catch (error) {
  }
};

const sendPrescriptionNotification = async (prescription, patient, doctor) => {
  try {
    const medicationSummary =
      buildMedicationSummary(prescription) || "Medication details unavailable";

    await dispatchEmail({
      user: patient,
      subject: "New Prescription Issued",
      html: `
        <div>
          <h2>New Prescription Issued</h2>
          <p>Medication: ${medicationSummary}</p>
          <p>Issued by Dr. ${doctor.name}</p>
        </div>
      `,
      type: "PRESCRIPTION_ISSUED",
      relatedAppointmentId: prescription.appointment,
    });

    await dispatchSMS({
      user: patient,
      message: `Dr. ${doctor.name} has issued a new prescription for you. Check your telehealth app.`,
      type: "PRESCRIPTION_ISSUED",
      relatedAppointmentId: prescription.appointment,
    });
  } catch (error) {
  }
};

const sendCriticalTriageAlert = async (triageReport, patient) => {
  try {
    await dispatchEmail({
      user: patient,
      subject: "URGENT: Seek Immediate Medical Attention",
      html: `
        <div>
          <h2>Urgent Medical Alert</h2>
          <p>Urgency level: ${triageReport.urgencyLevel || "CRITICAL"}</p>
          <p>AI recommendation: ${triageReport.recommendation || "Seek immediate medical attention."}</p>
          <p>Disclaimer: This is not a diagnosis. If you feel unsafe, contact emergency services immediately.</p>
          <p>Emergency contacts: ${triageReport.emergencyContacts || "Local emergency services"}</p>
        </div>
      `,
      type: "TRIAGE_CRITICAL_ALERT",
    });

    await dispatchSMS({
      user: patient,
      message:
        "URGENT: Based on your symptoms, please seek immediate medical attention.",
      type: "TRIAGE_CRITICAL_ALERT",
    });

    if (!process.env.ADMIN_EMAIL) {
      return;
    }

    const adminHtml = `
      <div>
        <h2>Critical Triage Alert</h2>
        <p>Patient: ${patient.name}</p>
        <p>Email: ${patient.email}</p>
        <p>Phone: ${(patient.profile && patient.profile.phone) || "N/A"}</p>
        <p>Triage summary: ${triageReport.summary || triageReport.recommendation || "Critical AI triage alert."}</p>
      </div>
    `;

    const adminUser = await User.findOne({
      email: process.env.ADMIN_EMAIL.toLowerCase(),
      role: "ADMIN",
    }).select("name email");

    if (adminUser) {
      await dispatchEmail({
        user: adminUser,
        subject: `CRITICAL TRIAGE ALERT - Patient: ${patient.name}`,
        html: adminHtml,
        type: "TRIAGE_CRITICAL_ALERT",
      });
      return;
    }

    if (!emailService.isEmailConfigured()) {
      await saveNotificationLog({
        recipientId: patient._id,
        type: "TRIAGE_CRITICAL_ALERT",
        channel: "EMAIL",
        subject: `CRITICAL TRIAGE ALERT - Patient: ${patient.name}`,
        message: htmlToText(adminHtml),
        status: "FAILED",
        errorMessage: "Email not configured",
      });
      return;
    }

    try {
      await emailService.sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `CRITICAL TRIAGE ALERT - Patient: ${patient.name}`,
        html: adminHtml,
      });

      await saveNotificationLog({
        recipientId: patient._id,
        type: "TRIAGE_CRITICAL_ALERT",
        channel: "EMAIL",
        subject: `CRITICAL TRIAGE ALERT - Patient: ${patient.name}`,
        message: htmlToText(adminHtml),
        status: "SENT",
        errorMessage: `Delivered to admin email ${process.env.ADMIN_EMAIL}`,
      });
    } catch (error) {
      await saveNotificationLog({
        recipientId: patient._id,
        type: "TRIAGE_CRITICAL_ALERT",
        channel: "EMAIL",
        subject: `CRITICAL TRIAGE ALERT - Patient: ${patient.name}`,
        message: htmlToText(adminHtml),
        status: "FAILED",
        errorMessage: error.message,
      });
    }
  } catch (error) {
  }
};

module.exports = {
  saveNotificationLog,
  dispatchEmail,
  dispatchSMS,
  sendAppointmentConfirmation,
  sendCancellationNotice,
  sendAppointmentReminder,
  sendPrescriptionNotification,
  sendCriticalTriageAlert,
  sendPasswordResetEmail: emailService.sendPasswordResetEmail,
  buildDateTime,
};
