// Head Office's MCB forms track a switch's position (ON/OFF), not
// cleanliness — a completely separate vocabulary from the shared
// Clean/Not Clean one used by every other Head Office checkpoint.
const MCB_STATUS_OPTIONS = ["ON", "OFF", "Holiday", "Leave", "Absent", "Form not fill", "Timestamp Missing", "NA", "Blur Image"];

module.exports = { MCB_STATUS_OPTIONS };
