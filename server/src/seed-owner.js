const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { prisma } = require("./lib/prisma");

dotenv.config();

async function main() {
  const ownerEmail = "owner@se7enfit.in";
  const ownerPassword = "Owner@12345";

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const owner = await prisma.user.upsert({
    where: {
      email: ownerEmail,
    },
    update: {
      role: "OWNER",
      passwordHash,
      isActive: true,
    },
    create: {
      name: "SE7EN FIT Owner",
      email: ownerEmail,
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  console.log("Owner account ready:");
  console.log({
    id: owner.id,
    email: owner.email,
    role: owner.role,
  });
  console.log("Password:", ownerPassword);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });