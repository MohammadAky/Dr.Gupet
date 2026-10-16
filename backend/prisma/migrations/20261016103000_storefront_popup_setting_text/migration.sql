-- Widen existing setting content; numeric overrides and keys remain unchanged.
ALTER TABLE `Setting` MODIFY `value` TEXT NOT NULL;
