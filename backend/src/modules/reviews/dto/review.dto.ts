import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ReviewListQueryDto extends PaginationQueryDto {}

export class WriteReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5, description: 'Whole stars, 1..5' })
  @IsInt({ message: 'امتیاز باید عدد صحیح بین ۱ تا ۵ باشد' })
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ minLength: 3, maxLength: 1000, description: 'Plain text, no HTML' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'متن نظر باید دست‌کم ۳ نویسه باشد' })
  @MaxLength(1000, { message: 'متن نظر حداکثر ۱۰۰۰ نویسه است' })
  body: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt({ message: 'امتیاز باید عدد صحیح بین ۱ تا ۵ باشد' })
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ minLength: 3, maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'متن نظر باید دست‌کم ۳ نویسه باشد' })
  @MaxLength(1000, { message: 'متن نظر حداکثر ۱۰۰۰ نویسه است' })
  body?: string;
}
