const { PrismaClient } = require("@prisma/client");
const createHttpError = require("http-errors");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();

const getAllTicket = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const code = req.query.code || "";
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const offset = (page - 1) * limit;

        const tickets = await prisma.ticket.findMany({
            include: {
                user: {
                    include: {
                        auth: {
                            select: {
                                id: true,
                                email: true,
                                isVerified: true,
                            },
                        },
                    },
                },
                ticketTransaction: {
                    include: {
                        Transaction_Detail: {
                            include: {
                                seat: true,
                            },
                        },
                    },
                },
                flight: {
                    include: {
                        plane: true,
                        departureAirport: true,
                        transitAirport: true,
                        destinationAirport: true,
                    },
                },
            },
            where: {
                AND: [
                    { code: { contains: code } },
                    { code: { contains: search } },
                ],
            },
            orderBy: {
                id: "asc",
            },
            skip: offset,
            take: limit,
        });

        const count = await prisma.ticket.count({
            where: {
                AND: [
                    { code: { contains: code } },
                    { code: { contains: search } },
                ],
            },
        });

        res.status(200).json({
            status: true,
            totalItems: count,
            pagination: {
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                pageItems: tickets.length,
                nextPage: page < Math.ceil(count / limit) ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null,
            },
            data: tickets,
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};

const getTicketById = async (req, res, next) => {
    try {
        const ticket = await prisma.ticket.findMany({
            where: {
                // userId: req.user.id,
                ticketTransactionId: req.params.ticketTransactionId,
            },
            include: {
                flight: true,
                user: {
                    include: {
                        auth: {
                            select: {
                                email: true,
                                isVerified: true,
                                id: true,
                            },
                        },
                    },
                },
                ticketTransaction: {
                    include: {
                        Transaction_Detail: {
                            include: {
                                seat: true,
                            },
                        },
                    },
                },
            },
        });

        if (!ticket) {
            return next(createHttpError(404, { message: "Ticket not found" }));
        }
        res.status(200).json({
            status: true,
            message: "Ticket data retrieved successfully",
            data: ticket,
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};

const createTicket = async (req, res, next) => {
    const { flightId, userId, seatId, transactionId, detailTransactionId } =
        req.body;

    try {
        // Check if the flight exists
        const flight = await prisma.flight.findUnique({
            where: { id: flightId },
            include: {
                plane: true,
                departureAirport: true,
            },
        });
        if (!flight) {
            return next(createHttpError(404, { message: "Flight not found" }));
        }

        // Check if the USER exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return next(createHttpError(404, { message: "User not found" }));
        }

        // Check if the seat exists and is not booked
        const seat = await prisma.flightSeat.findUnique({
            where: { id: seatId },
        });
        if (!seat) {
            return next(createHttpError(404, { message: "Seat not found" }));
        }
        if (seat.isBooked) {
            return next(
                createHttpError(400, { message: "Seat is already booked" })
            );
        }

        const airlineCode = flight.plane.code;
        const airportCode = flight.departureAirport.code;
        const flightCode = flight.code;
        const seatNumber = seat.seatNumber;
        let uniqueCode = `${airlineCode}-${airportCode}-${flightCode}-${seatNumber}`;
        let isUnique = false;

        // Ensure the code is unique
        while (!isUnique) {
            const existingTicket = await prisma.ticket.findUnique({
                where: { code: uniqueCode },
            });

            if (existingTicket) {
                // Append a unique identifier to ensure uniqueness
                uniqueCode = `${airlineCode}-${airportCode}-${flightCode}-${seatNumber}-${uuidv4()}`;
            } else {
                isUnique = true;
            }
        }

        // Create the new ticket
        const newTicket = await prisma.ticket.create({
            data: {
                code: uniqueCode,
                flight: { connect: { id: flightId } },
                user: { connect: { id: userId } },
                seat: { connect: { id: seatId } },
                ticketTransaction: { connect: { id: transactionId } },
                ticketTransactionDetail: {
                    connect: { id: detailTransactionId },
                },
            },

            include: {
                flight: true,
                user: true,
                seat: true,
                ticketTransaction: true,
                ticketTransactionDetail: true,
            },
        });

        res.status(201).json({
            status: true,
            message: "Ticket created successfully",
            data: newTicket,
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};

const updateTicket = async (req, res, next) => {
    const { flightId, userId, seatId, transactionId, detailTransactionId } =
        req.body;

    try {
        const ticket = await prisma.ticket.findFirst({
            where: { ticketTransactionId: req.params.ticketTransactionId },
            include: {
                flight: true,
                user: true,
                seat: true,
                ticketTransaction: true,
                ticketTransactionDetail: true,
            },
        });
        if (!ticket) {
            return next(createHttpError(404, { message: "Ticket not found" }));
        }

        const updatedTicket = await prisma.ticket.update({
            where: { id: req.params.id },
            data: {
                flight: { connect: { id: flightId } },
                user: { connect: { id: userId } },
                seat: { connect: { id: seatId } },
                ticketTransaction: { connect: { id: transactionId } },
                ticketTransactionDetail: {
                    connect: { id: detailTransactionId },
                },
            },
        });
        res.status(200).json({
            status: true,
            message: "Ticket updated successfully",
            data: updatedTicket,
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};

const deleteTicket = async (req, res, next) => {
    try {
        const ticket = await prisma.ticket.findFirst({
            where: { ticketTransactionId: req.params.ticketTransactionId },
        });

        if (!ticket) {
            return next(createHttpError(404, { message: "Ticket not found" }));
        }

        await prisma.ticket.delete({
            where: { id: req.params.id },
        });
        res.status(200).json({
            status: true,
            message: "Ticket deleted successfully",
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};

const generateTicket = async (req, res, next) => {
    try {
        const tickets = await prisma.ticket.findMany({
            where: {
                userId: req.user.id,
                ticketTransactionId: req.query.ticketTransactionId,
            },
            include: {
                user: {
                    include: {
                        auth: {
                            select: {
                                id: true,
                                email: true,
                                isVerified: true,
                            },
                        },
                    },
                },
                ticketTransaction: {
                    include: {
                        Transaction_Detail: true,
                    },
                },
                seat: true,
                flight: {
                    include: {
                        plane: true,
                        departureAirport: true,
                        transitAirport: true,
                        destinationAirport: true,
                    },
                },
            },
        });

        let seatsId = [];
        let seats = [];
console.log(req.query.ticketTransactionId)
        tickets.forEach((ticketTransaction) => {
            ticketTransaction.ticketTransaction.Transaction_Detail.forEach((detail) => {
                seatsId.push(detail.seatId);
            });
        });

        console.log(seatsId);

        const fetchSeats = async () => {
            for (const id of seatsId) {
                try {
                    const seat = await prisma.flightSeat.findUnique({
                        where: {
                            id: id,
                        },
                    });
                    seats.push(seat);
                } catch (error) {
                    console.error(`Error fetching seat with ID ${id}:`, error);
                }
            }
        };

        await fetchSeats();

        res.render("templates/ticket.ejs", {
            data: tickets,
            tickets: tickets,
            seats: seats
        });
    } catch (error) {
        next(createHttpError(500, { message: error.message }));
    }
};


module.exports = {
    getAllTicket,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket,
    generateTicket,
};
