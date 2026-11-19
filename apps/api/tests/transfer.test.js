import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import {
  User,
  Wallet,
  Transfer,
  LedgerEntry,
  IdempotencyRecord,
} from "../src/models/index.js";
import { env } from "../src/config/env.js";

describe("Transfer API", () => {
  let sender;
  let receiver;
  let senderWallet;
  let receiverWallet;
  let token;

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Wallet.deleteMany({}),
      Transfer.deleteMany({}),
      LedgerEntry.deleteMany({}),
      IdempotencyRecord.deleteMany({}),
    ]);

    sender = await User.create({
      name: "Sender Tester",
      email: "sender@payflow.dev",
      passwordHash: "test-password-hash",
    });

    receiver = await User.create({
      name: "Receiver Tester",
      email: "receiver@payflow.dev",
      passwordHash: "test-password-hash",
    });

    senderWallet = await Wallet.create({
      user: sender._id,
      currency: "INR",
      balance: 50000,
      status: "active",
    });

    receiverWallet = await Wallet.create({
      user: receiver._id,
      currency: "INR",
      balance: 10000,
      status: "active",
    });

    token = jwt.sign({ sub: sender._id.toString() }, env.jwtSecret, {
      expiresIn: "1h",
      issuer: "payflow-api",
      audience: "payflow-web",
    });
  });

  it("should complete a transfer and create two ledger entries", async () => {
    const response = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-test-0001")
      .send({
        receiverEmail: receiver.email,
        amount: 10000,
        description: "Test transfer",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.transfer).toMatchObject({
      amount: 10000,
      currency: "INR",
      status: "completed",
      description: "Test transfer",
    });

    const updatedSenderWallet = await Wallet.findById(senderWallet._id);
    const updatedReceiverWallet = await Wallet.findById(receiverWallet._id);

    expect(updatedSenderWallet.balance).toBe(40000);
    expect(updatedReceiverWallet.balance).toBe(20000);

    const transfers = await Transfer.find({});
    const ledgerEntries = await LedgerEntry.find({});

    expect(transfers).toHaveLength(1);
    expect(ledgerEntries).toHaveLength(2);

    expect(ledgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "debit",
          amount: 10000,
        }),
        expect.objectContaining({
          type: "credit",
          amount: 10000,
        }),
      ]),
    );
  });

  it("should reject a transfer when the sender has insufficient funds", async () => {
    const response = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-test-0002")
      .send({
        receiverEmail: receiver.email,
        amount: 60000,
      });

    expect(response.status).toBe(400);

    const updatedSenderWallet = await Wallet.findById(senderWallet._id);
    const updatedReceiverWallet = await Wallet.findById(receiverWallet._id);

    expect(updatedSenderWallet.balance).toBe(50000);
    expect(updatedReceiverWallet.balance).toBe(10000);

    expect(await Transfer.countDocuments()).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
    expect(await IdempotencyRecord.countDocuments()).toBe(0);
  });

  it("should reject a transfer to the sender's own wallet", async () => {
    const response = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-test-0003")
      .send({
        receiverEmail: sender.email,
        amount: 1000,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      "You cannot transfer money to yourself",
    );

    const updatedSenderWallet = await Wallet.findById(senderWallet._id);

    expect(updatedSenderWallet.balance).toBe(50000);
    expect(await Transfer.countDocuments()).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });

  it("should not execute the same transfer twice with the same idempotency key", async () => {
    const transferRequest = {
      receiverEmail: receiver.email,
      amount: 10000,
      description: "Idempotency test",
    };

    const firstResponse = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-idempotent-0001")
      .send(transferRequest);

    const secondResponse = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-idempotent-0001")
      .send(transferRequest);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);

    expect(secondResponse.body.data.transfer.id).toBe(
      firstResponse.body.data.transfer.id,
    );

    expect(
      await Wallet.findById(senderWallet._id).then((wallet) => wallet.balance),
    ).toBe(40000);

    expect(
      await Wallet.findById(receiverWallet._id).then(
        (wallet) => wallet.balance,
      ),
    ).toBe(20000);

    expect(await Transfer.countDocuments()).toBe(1);
    expect(await LedgerEntry.countDocuments()).toBe(2);
    expect(await IdempotencyRecord.countDocuments()).toBe(1);
  });

  it("should reject reuse of an idempotency key with different request details", async () => {
    const firstResponse = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-idempotent-0002")
      .send({
        receiverEmail: receiver.email,
        amount: 10000,
        description: "Original request",
      });

    const secondResponse = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "transfer-idempotent-0002")
      .send({
        receiverEmail: receiver.email,
        amount: 20000,
        description: "Changed request",
      });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(409);

    expect(secondResponse.body.error.message).toBe(
      "Idempotency key has already been used with different request details",
    );

    expect(
      await Wallet.findById(senderWallet._id).then((wallet) => wallet.balance),
    ).toBe(40000);

    expect(
      await Wallet.findById(receiverWallet._id).then(
        (wallet) => wallet.balance,
      ),
    ).toBe(20000);

    expect(await Transfer.countDocuments()).toBe(1);
    expect(await LedgerEntry.countDocuments()).toBe(2);
  });

  it("should prevent concurrent transfers from spending the same funds twice", async () => {
    const makeTransferRequest = (idempotencyKey) =>
      request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          receiverEmail: receiver.email,
          amount: 40000,
          description: "Concurrent transfer test",
        });

    // Start both requests without waiting for either to finish.
    const responses = await Promise.all([
      makeTransferRequest("transfer-concurrent-0001"),
      makeTransferRequest("transfer-concurrent-0002"),
    ]);

    // Exactly one request should succeed.
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);

    // Check the final wallet balances.
    const updatedSenderWallet = await Wallet.findById(senderWallet._id);
    const updatedReceiverWallet = await Wallet.findById(receiverWallet._id);

    expect(updatedSenderWallet.balance).toBe(10000);
    expect(updatedReceiverWallet.balance).toBe(50000);

    // Only the successful request should create transfer records.
    expect(await Transfer.countDocuments()).toBe(1);
    expect(await LedgerEntry.countDocuments()).toBe(2);
    expect(await IdempotencyRecord.countDocuments()).toBe(1);
  });

  it("should execute simultaneous requests with the same idempotency key only once", async () => {
    const makeTransferRequest = () =>
      request(app)
        .post("/api/v1/transfers")
        .set("Authorization", `Bearer ${token}`)
        .set("Idempotency-Key", "transfer-same-key-0001")
        .send({
          receiverEmail: receiver.email,
          amount: 10000,
          description: "Same key concurrency test",
        });

    const responses = await Promise.all([
      makeTransferRequest(),
      makeTransferRequest(),
    ]);

    expect(responses[0].status).toBe(201);
    expect(responses[1].status).toBe(201);

    expect(responses[0].body.data.transfer.id).toBe(
      responses[1].body.data.transfer.id,
    );

    const updatedSenderWallet = await Wallet.findById(senderWallet._id);
    const updatedReceiverWallet = await Wallet.findById(receiverWallet._id);

    expect(updatedSenderWallet.balance).toBe(40000);
    expect(updatedReceiverWallet.balance).toBe(20000);

    expect(await Transfer.countDocuments()).toBe(1);
    expect(await LedgerEntry.countDocuments()).toBe(2);
    expect(await IdempotencyRecord.countDocuments()).toBe(1);
  });

    it.each([
    ["zero", 0],
    ["negative", -5000],
    ["decimal", 1000.5],
  ])("should reject a %s transfer amount", async (_label, amount) => {
    const response = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `transfer-invalid-${_label}`)
      .send({
        receiverEmail: receiver.email,
        amount,
      });

    expect(response.status).toBe(400);

    expect(await Wallet.findById(senderWallet._id).then((wallet) => wallet.balance))
      .toBe(50000);

    expect(await Wallet.findById(receiverWallet._id).then((wallet) => wallet.balance))
      .toBe(10000);

    expect(await Transfer.countDocuments()).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });

    it.each([
    ["malformed", "not-an-email"],
    ["missing", undefined],
  ])("should reject a %s receiver email", async (_label, receiverEmail) => {
    const payload = {
      amount: 10000,
    };

    if (receiverEmail !== undefined) {
      payload.receiverEmail = receiverEmail;
    }

    const response = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `transfer-invalid-email-${_label}`)
      .send(payload);

    expect(response.status).toBe(400);

    expect(await Wallet.findById(senderWallet._id).then((wallet) => wallet.balance))
      .toBe(50000);

    expect(await Transfer.countDocuments()).toBe(0);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });
  

  it("should return sent transactions with recipient details", async () => {
    await Transfer.create({
      sender: senderWallet._id,
      receiver: receiverWallet._id,
      amount: 5000,
      currency: "INR",
      status: "completed",
      reference: "PF-HISTORY-SENT-001",
      description: "Lunch payment",
    });

    const response = await request(app)
      .get("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.transactions).toHaveLength(1);

    expect(response.body.data.transactions[0]).toMatchObject({
      reference: "PF-HISTORY-SENT-001",
      direction: "sent",
      amount: 5000,
      currency: "INR",
      status: "completed",
      description: "Lunch payment",
      counterparty: {
        name: receiver.name,
        email: receiver.email,
      },
    });

    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it("should return received transactions with sender details", async () => {
    await Transfer.create({
      sender: receiverWallet._id,
      receiver: senderWallet._id,
      amount: 7500,
      currency: "INR",
      status: "completed",
      reference: "PF-HISTORY-RECEIVED-001",
      description: "Payment received",
    });

    const response = await request(app)
      .get("/api/v1/transfers")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);

    expect(response.body.data.transactions[0]).toMatchObject({
      reference: "PF-HISTORY-RECEIVED-001",
      direction: "received",
      amount: 7500,
      counterparty: {
        name: receiver.name,
        email: receiver.email,
      },
    });
  });

  it("should paginate transaction history correctly", async () => {
    const transfers = Array.from({ length: 12 }, (_, index) => ({
      sender: senderWallet._id,
      receiver: receiverWallet._id,
      amount: 1000 + index,
      currency: "INR",
      status: "completed",
      reference: `PF-HISTORY-PAGE-${String(index).padStart(3, "0")}`,
      description: `Pagination test ${index}`,
    }));

    await Transfer.create(transfers);

    const firstPage = await request(app)
      .get("/api/v1/transfers?page=1&limit=5")
      .set("Authorization", `Bearer ${token}`);

    const secondPage = await request(app)
      .get("/api/v1/transfers?page=2&limit=5")
      .set("Authorization", `Bearer ${token}`);

    expect(firstPage.status).toBe(200);
    expect(secondPage.status).toBe(200);

    expect(firstPage.body.data.transactions).toHaveLength(5);
    expect(secondPage.body.data.transactions).toHaveLength(5);

    expect(firstPage.body.data.pagination).toMatchObject({
      page: 1,
      limit: 5,
      total: 12,
      totalPages: 3,
    });

    const firstIds = firstPage.body.data.transactions.map((item) => item.id);
    const secondIds = secondPage.body.data.transactions.map((item) => item.id);

    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  it("should reject transaction history requests without authentication", async () => {
    const response = await request(app).get("/api/v1/transfers");

    expect(response.status).toBe(401);
  });

  it("should reject invalid transaction pagination parameters", async () => {
    const response = await request(app)
      .get("/api/v1/transfers?page=0&limit=100")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

});