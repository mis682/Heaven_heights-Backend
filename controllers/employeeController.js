const Employee = require("../models/Employee");

exports.list = async (req, res) => {
  const { department, active } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (active !== undefined) filter.active = active === "true";
  const employees = await Employee.find(filter).sort({ name: 1 });
  res.json(employees);
};

exports.create = async (req, res) => {
  const employee = await Employee.create(req.body);
  res.status(201).json(employee);
};

exports.update = async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  res.json(employee);
};

exports.remove = async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) return res.status(404).json({ message: "Employee not found" });
  res.json({ message: "Employee deleted" });
};
