import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { SetPetTagsDto } from './dto/set-pet-tags.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Pets')
@ApiBearerAuth()
@Controller('pets')
export class PetsController {
  constructor(private petsService: PetsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all my pets' })
  @ApiResponse({ status: 200, description: 'Pets returned' })
  async findAll(@CurrentUser('sub') userId: number) {
    return this.petsService.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create new pet' })
  @ApiResponse({ status: 201, description: 'Pet created' })
  async create(
    @CurrentUser('sub') userId: number,
    @Body() dto: CreatePetDto,
  ) {
    return this.petsService.create(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pet by ID' })
  @ApiResponse({ status: 200, description: 'Pet returned' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async findOne(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update pet' })
  @ApiResponse({ status: 200, description: 'Pet updated' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async update(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.update(userId, id, dto);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Set pet tags (replace all)' })
  @ApiResponse({ status: 200, description: 'Tags updated' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async setTags(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPetTagsDto,
  ) {
    return this.petsService.setTags(userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete pet (soft delete)' })
  @ApiResponse({ status: 200, description: 'Pet deleted' })
  @ApiResponse({ status: 404, description: 'Pet not found' })
  async remove(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.petsService.remove(userId, id);
  }
}