-- Issue #38: idempotent, atomic guest-cart handoff.
CREATE TABLE `GuestTransfer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `payloadHash` VARCHAR(64) NOT NULL,
    `result` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GuestTransfer_userId_requestId_key`(`userId`, `requestId`),
    INDEX `GuestTransfer_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GuestTransfer` ADD CONSTRAINT `GuestTransfer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
