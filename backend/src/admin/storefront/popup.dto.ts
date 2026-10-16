import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export const POPUP_IMAGE_PATH =
  /^(?:|\/(?:brand|uploads)\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:webp|png|jpe?g))$/;

export class PopupDto {
  @IsBoolean()
  enabled: boolean;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(90)
  title: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(800)
  body: string;

  @IsString()
  @MaxLength(500)
  @Matches(POPUP_IMAGE_PATH, { message: 'تصویر باید از فایل‌های همین سایت باشد' })
  image: string;
}
