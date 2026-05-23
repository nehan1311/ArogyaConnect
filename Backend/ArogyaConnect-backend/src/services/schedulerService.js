const cron = require("node-cron");

const Appointment = require("../models/Appointment");
const notificationService = require("./notificationService");

let schedulerStarted = false;

const pad = (value) => value.toString().padStart(2, "0");

const formatDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const buildAppointmentDateTime = (appointment) =>
  new Date(`${formatDate(appointment.date)}T${appointment.startTime}:00`);

const filterAppointmentsInWindow = (appointments, windowStart, windowEnd) =>
  appointments.filter((appointment) => {
    const appointmentDateTime = buildAppointmentDateTime(appointment);
    return appointmentDateTime >= windowStart && appointmentDateTime <= windowEnd;
  });

const fetchCandidateAppointments = async (reminderField, windowEnd) => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const endDay = new Date(windowEnd);
  endDay.setHours(23, 59, 59, 999);

  return Appointment.find({
    status: "CONFIRMED",
    [`reminderSent.${reminderField}`]: false,
    date: { $gte: dayStart, $lte: endDay },
  })
    .populate("patient", "name email profile.phone")
    .populate("doctor", "name email profile.phone");
};

const processOneHourReminders = async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);
    const appointments = await fetchCandidateAppointments("oneHour", windowEnd);
    const matches = filterAppointmentsInWindow(
      appointments,
      windowStart,
      windowEnd
    );

    console.log(
      `Reminder cron: checked at ${now.toISOString()}, found ${matches.length} appointments`
    );

    for (const appointment of matches) {
      await notificationService.sendAppointmentReminder(appointment, "1HR");
    }
  } catch (error) {
    console.error("Reminder cron 1HR failed:", error);
  }
};

const processFifteenMinuteReminders = async () => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 12 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 17 * 60 * 1000);
    const appointments = await fetchCandidateAppointments("fifteenMin", windowEnd);
    const matches = filterAppointmentsInWindow(
      appointments,
      windowStart,
      windowEnd
    );

    console.log(
      `Reminder cron: checked at ${now.toISOString()}, found ${matches.length} appointments`
    );

    for (const appointment of matches) {
      await notificationService.sendAppointmentReminder(appointment, "15MIN");
    }
  } catch (error) {
    console.error("Reminder cron 15MIN failed:", error);
  }
};

const startScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  cron.schedule("*/5 * * * *", processOneHourReminders);
  cron.schedule("* * * * *", processFifteenMinuteReminders);
  schedulerStarted = true;
};

startScheduler();

module.exports = {
  startScheduler,
  processOneHourReminders,
  processFifteenMinuteReminders,
};
