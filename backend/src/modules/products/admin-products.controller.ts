import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminProductsService } from './admin-products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  AddProductImageDto,
  SetProductTagsDto,
} from './dto/admin-product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../admin/audit/audit.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Admin - Products')
@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminProductsController {
  constructor(
    private adminProductsService: AdminProductsService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List products incl. inactive (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated products' })
  async findAll(
    @Query() query: PaginationQueryDto,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('brandId') brandId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('petTypeId') petTypeId?: string,
  ) {
    return this.adminProductsService.findAllAdmin({
      ...query,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      brandId: brandId ? Number(brandId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      petTypeId: petTypeId ? Number(petTypeId) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail (admin only)' })
  @ApiResponse({ status: 200, description: 'Product detail' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminProductsService.findOneAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create product (admin only)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  async create(@Body() dto: CreateProductDto, @Req() req: any) {
    const product = await this.adminProductsService.create(dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'Product',
      entityId: product.id,
      summary: product.name,
      ip: req.ip,
    });
    return product;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update product (admin only)' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @Req() req: any,
  ) {
    const product = await this.adminProductsService.update(id, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      summary: Object.keys(dto).join(','),
      ip: req.ip,
    });
    return product;
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete product — deactivates when already ordered (admin only)' })
  @ApiResponse({ status: 200, description: 'Delete result' })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const result = await this.adminProductsService.remove(id);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'Product',
      entityId: id,
      summary: result.deleted ? 'deleted' : 'deactivated (has orders)',
      ip: req.ip,
    });
    return result;
  }

  // ---- Variants ----

  @Post(':id/variants')
  @ApiOperation({ summary: 'Create product variant and recalculate minPrice (admin only)' })
  @ApiResponse({ status: 201, description: 'Variant created' })
  async createVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVariantDto,
    @Req() req: any,
  ) {
    const variant = await this.adminProductsService.createVariant(id, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'ProductVariant',
      entityId: variant.id,
      summary: `${dto.sku} (product ${id})`,
      ip: req.ip,
    });
    return variant;
  }

  @Patch('variants/:variantId')
  @ApiOperation({ summary: 'Update product variant and recalculate minPrice (admin only)' })
  @ApiResponse({ status: 200, description: 'Variant updated' })
  async updateVariant(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() dto: UpdateVariantDto,
    @Req() req: any,
  ) {
    const variant = await this.adminProductsService.updateVariant(variantId, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'ProductVariant',
      entityId: variantId,
      summary: Object.keys(dto).join(','),
      ip: req.ip,
    });
    return variant;
  }

  @Delete('variants/:variantId')
  @ApiOperation({ summary: 'Delete variant — deactivates when already ordered (admin only)' })
  @ApiResponse({ status: 200, description: 'Delete result' })
  async removeVariant(@Param('variantId', ParseIntPipe) variantId: number, @Req() req: any) {
    const result = await this.adminProductsService.removeVariant(variantId);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'ProductVariant',
      entityId: variantId,
      summary: result.deleted ? 'deleted' : 'deactivated (has orders)',
      ip: req.ip,
    });
    return result;
  }

  // ---- Images ----

  @Post(':id/images')
  @ApiOperation({ summary: 'Add product image (admin only)' })
  @ApiResponse({ status: 201, description: 'Image added' })
  async addImage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProductImageDto,
    @Req() req: any,
  ) {
    const image = await this.adminProductsService.addImage(id, dto.url, dto.sortOrder);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'CREATE',
      entity: 'ProductImage',
      entityId: image.id,
      summary: dto.url,
      ip: req.ip,
    });
    return image;
  }

  @Delete('images/:imageId')
  @ApiOperation({ summary: 'Remove product image (admin only)' })
  @ApiResponse({ status: 200, description: 'Image removed' })
  async removeImage(@Param('imageId', ParseIntPipe) imageId: number, @Req() req: any) {
    const result = await this.adminProductsService.removeImage(imageId);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'DELETE',
      entity: 'ProductImage',
      entityId: imageId,
      ip: req.ip,
    });
    return result;
  }

  // ---- Tags ----

  @Put(':id/tags')
  @ApiOperation({
    summary: 'Replace product tags (CONTAINS=ALLERGEN, SUITABLE_FOR=DIET) (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Tags replaced' })
  async setTags(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetProductTagsDto,
    @Req() req: any,
  ) {
    const product = await this.adminProductsService.setTags(id, dto);
    await this.auditService.record({
      adminId: req.user.sub,
      action: 'UPDATE',
      entity: 'Product',
      entityId: id,
      summary: `tags contains=[${dto.contains ?? []}] suitableFor=[${dto.suitableFor ?? []}]`,
      ip: req.ip,
    });
    return product;
  }
}
