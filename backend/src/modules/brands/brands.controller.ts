import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrandsService } from './brands.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private brandsService: BrandsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active brands' })
  @ApiResponse({ status: 200, description: 'Brands returned' })
  async findAll() {
    return this.brandsService.findAll();
  }
}