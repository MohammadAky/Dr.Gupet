import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const optionalText = (maximum = 191) =>
  applyDecorators(IsOptional(), IsString(), MaxLength(maximum));
const optionalId = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(2147483647),
  );
// Type(() => Boolean) turns the string "false" into true; parse only the two supported literals.
const optionalBoolean = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      value === 'true' ? true : value === 'false' ? false : value,
    ),
    IsBoolean(),
  );
const optionalDate = () => applyDecorators(IsOptional(), IsISO8601({ strict: true }));

/** Each class allowlists one endpoint's entire query, including inherited pagination. */
export class AdminProductListQueryDto extends PaginationQueryDto {
  @optionalText() search?: string;
  @optionalBoolean() isActive?: boolean;
  @optionalId() brandId?: number;
  @optionalId() categoryId?: number;
  @optionalId() petTypeId?: number;
}

export class AdminMedicineListQueryDto extends PaginationQueryDto {
  @optionalText() q?: string;
  @optionalBoolean() isActive?: boolean;
}

export class AdminPharmacyListQueryDto extends AdminMedicineListQueryDto {
  @optionalText() city?: string;
  @optionalText() province?: string;
}

export class AdminClinicListQueryDto extends AdminPharmacyListQueryDto {
  @optionalBoolean() isVerified?: boolean;
}

export class AdminCouponListQueryDto extends PaginationQueryDto {
  @optionalText() search?: string;
  @optionalBoolean() isActive?: boolean;
}

export class AdminUserListQueryDto extends PaginationQueryDto {
  @optionalText() search?: string;
  @IsOptional() @IsIn(['USER', 'ADMIN']) role?: string;
  @IsOptional() @IsIn(['ACTIVE', 'BLOCKED']) status?: string;
}

export class AdminOrderListQueryDto extends PaginationQueryDto {
  @optionalText() search?: string;
  @IsOptional()
  @IsIn(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED'])
  status?: string;
  @optionalId() userId?: number;
  @optionalDate() from?: string;
  @optionalDate() to?: string;
}

export class AdminPaymentListQueryDto extends PaginationQueryDto {
  @IsOptional() @IsIn(['INITIATED', 'PENDING', 'SUCCESS', 'FAILED']) status?: string;
  @optionalText() gateway?: string;
  @optionalDate() from?: string;
  @optionalDate() to?: string;
}

export class AdminAuditListQueryDto extends PaginationQueryDto {
  @optionalText() entity?: string;
  @optionalText() action?: string;
  @optionalId() adminId?: number;
}

export class AdminSmsListQueryDto extends PaginationQueryDto {
  @optionalText(32) phone?: string;
  @IsOptional() @IsIn(['OTP', 'NOTIFY']) kind?: string;
  @IsOptional() @IsIn(['SENT', 'FAILED']) status?: string;
}

/** Reference lists intentionally do not accept pagination or unrelated catalog filters. */
export class AdminReferenceListQueryDto {
  @optionalText() search?: string;
  @optionalBoolean() isActive?: boolean;
}

export class AdminPetReferenceListQueryDto extends AdminReferenceListQueryDto {
  @optionalId() petTypeId?: number;
}

export class AdminTagListQueryDto extends AdminReferenceListQueryDto {
  @IsOptional() @IsIn(['ALLERGEN', 'DIET']) type?: string;
}

export class AdminDashboardQueryDto {
  @optionalText(100) tz?: string;
}

export class AdminReportRangeQueryDto extends AdminDashboardQueryDto {
  @optionalDate() from?: string;
  @optionalDate() to?: string;
}

export class AdminTopProductsQueryDto extends AdminReportRangeQueryDto {
  @optionalId() limit?: number;
}

export class AdminLowStockQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2147483647) threshold?: number;
}
