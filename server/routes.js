const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { authenticateToken } = require("./middleware");
const upload = require("./multer");
const axios = require("axios");
const FormData = require("form-data");

const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});
router.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/register.html"));
});
router.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/profile.html"));
});

// Register endpoint
router.post("/api/register", upload.single("file"), async (req, res) => {
  const { firstName, lastName, gender, dob, email, password } = req.body;


  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Create a FormData object to send the image in base64 format
  const formData = new FormData();
  formData.append("image", file.buffer.toString("base64"));

  // Send the image to ImgBB
  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.imgbbApi_key}`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  const profileImage = response.data.data.url;

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ message: "Error hashing password" });

    const sql =
      "INSERT INTO users (firstName, lastName, gender, dob, email, password, profileImage) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.query(
      sql,
      [firstName, lastName, gender, dob, email, hash, profileImage],
      (err, result) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "User registered" });
      }
    );
  });
});

// Login endpoint
router.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err)
        return res.status(500).json({ message: "Error comparing passwords" });
      if (!isMatch)
        return res.status(401).json({ message: "Invalid email or password" });

      const token = jwt.sign({ id: user.id }, "your_jwt_secret", {
        expiresIn: "1h",
      });
      res.json({ token });
    });
  });
});

// Get Profile endpoint
router.get("/api/profile", authenticateToken, (req, res) => {
  const sql =
    "SELECT firstName, lastName, gender, dob, email, profileImage FROM users WHERE id = ?";
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    const user = results[0];
    res.json(user);
  });
});

// Update Profile endpoint
router.put(
  "/api/profile",
  authenticateToken,
  upload.single("file"),
  (req, res) => {
    const { firstName, lastName, gender, dob, email } = req.body;
    // const profileImage = req.file
    //   ? `${req.file.filename}`
    //   : req.body.profileImage;

    const sql =
      "UPDATE users SET firstName = ?, lastName = ?, gender = ?, dob = ?, email = ? WHERE id = ?";
    db.query(
      sql,
      [firstName, lastName, gender, dob, email, req.user.id],
      (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });
        res.json({ message: "Profile updated" });
      }
    );
  }
);

// Delete Account endpoint
router.delete("/api/profile", authenticateToken, (req, res) => {
  const sql = "DELETE FROM users WHERE id = ?";
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json({ message: "Account deleted" });
  });
});

module.exports = router;
