const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        heightCm: true,
        weightKg: true,
        goal: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid or inactive user",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

function requireOwner(req, res, next) {
  if (!req.user || !["OWNER", "ADMIN"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Owner access required",
    });
  }

  next();
}

module.exports = {
  requireAuth,
  requireOwner,
};