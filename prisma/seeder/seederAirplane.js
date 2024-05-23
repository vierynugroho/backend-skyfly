const { PrismaClient } = require("@prisma/client");
const { secretHash } = require("../../utils/hashSalt");

const prisma = new PrismaClient();

async function main() {
    const Airline = [
        "Graf Indonesia",
        "Lion Water",
        "Super Man Jet",
        "JoshepLink",
        "Yoru Air",
        "Pravda Air"
    ];

    await Promise.all(
        Airline.map((name) =>
            prisma.user.create({
                data: {
                    name: name,
                    role: "BUYER",
                    phoneNumber: "628123456789",
                    Auth: {
                        create: {
                            email: `${name.toLowerCase()}@test.com`,
                            password: secretHash("password"),
                            isVerified: true,
                            otpToken: null,
                            secretToken: null,
                        },
                    },
                },
            })
        )
    );
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
