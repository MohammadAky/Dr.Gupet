import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { SettingsService } from './settings/settings.service';
import { SettingsController } from './settings/settings.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { ReportsService } from './reports/reports.service';
import { ReportsController } from './reports/reports.controller';

/**
 * Admin core: audit log, runtime settings, dashboard and reports.
 * Global so feature modules can inject AuditService/SettingsService
 * without importing this module.
 */
@Global()
@Module({
  controllers: [AuditController, SettingsController, DashboardController, ReportsController],
  providers: [AuditService, SettingsService, DashboardService, ReportsService],
  exports: [AuditService, SettingsService],
})
export class AdminModule {}
