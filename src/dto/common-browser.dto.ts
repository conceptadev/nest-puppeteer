import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type {
  AuthenticateOptions,
  CookieParam,
  GotoOptions,
  ResourceType,
  ScriptTagOptions,
  StyleTagOptions,
  ViewportOptions,
  WaitForSelectorOptions,
} from "../interfaces/common-options.interface.js";
import { IsUrlOrHtml } from "../validators/is-url-or-html.validator.js";

// ---------------------------------------------------------------------------
// Nested DTOs
// ---------------------------------------------------------------------------

class AuthenticateDto implements AuthenticateOptions {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

class GotoOptionsDto implements GotoOptions {
  @IsOptional()
  waitUntil?: any;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsString()
  referer?: string;

  @IsOptional()
  @IsString()
  referrerPolicy?: string;
}

class WaitForSelectorDto implements WaitForSelectorOptions {
  @IsString()
  selector!: string;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsNumber()
  timeout?: number;
}

class ViewportDto implements ViewportOptions {
  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  deviceScaleFactor?: number;

  @IsOptional()
  @IsBoolean()
  isMobile?: boolean;

  @IsOptional()
  @IsBoolean()
  isLandscape?: boolean;

  @IsOptional()
  @IsBoolean()
  hasTouch?: boolean;
}

// ---------------------------------------------------------------------------
// Base DTO — all endpoints extend this
// ---------------------------------------------------------------------------

export class CommonBrowserDto {
  @ApiPropertyOptional({ description: "URL to navigate to (provide url or html)" })
  @IsUrlOrHtml()
  url: string | undefined = undefined;

  @ApiPropertyOptional({ description: "HTML content to render directly (provide url or html)" })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ description: "HTTP Basic Auth credentials", type: AuthenticateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AuthenticateDto)
  authenticate?: AuthenticateOptions;

  @ApiPropertyOptional({ description: "Cookies to set before navigation", type: [Object] })
  @IsOptional()
  @IsArray()
  cookies?: CookieParam[];

  @ApiPropertyOptional({ description: "Navigation options", type: GotoOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GotoOptionsDto)
  gotoOptions?: GotoOptions;

  @ApiPropertyOptional({ description: "Extra HTTP headers", type: Object })
  @IsOptional()
  @IsObject()
  setExtraHTTPHeaders?: Record<string, string>;

  @ApiPropertyOptional({
    description: "Resource types to block",
    type: [String],
    example: ["image", "stylesheet"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rejectResourceTypes?: ResourceType[];

  @ApiPropertyOptional({ description: "Request URL regex patterns to block", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rejectRequestPattern?: string[];

  @ApiPropertyOptional({
    description: "Resource types to allow (blocks all others)",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowResourceTypes?: ResourceType[];

  @ApiPropertyOptional({ description: "Request URL regex patterns to allow", type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowRequestPattern?: string[];

  @ApiPropertyOptional({ description: "Custom user agent string" })
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional({
    description: "Wait for a CSS selector after navigation",
    type: WaitForSelectorDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => WaitForSelectorDto)
  waitForSelector?: WaitForSelectorOptions;

  @ApiPropertyOptional({
    description: "Wait for all fonts to finish loading (document.fonts.ready)",
  })
  @IsOptional()
  @IsBoolean()
  waitForFonts?: boolean;

  @ApiPropertyOptional({ description: "Static delay (ms) after navigation" })
  @IsOptional()
  @IsNumber()
  waitForTimeout?: number;

  @ApiPropertyOptional({ description: "Custom viewport dimensions", type: ViewportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ViewportDto)
  viewport?: ViewportOptions;

  @ApiPropertyOptional({ description: "Inject script tags before capturing", type: [Object] })
  @IsOptional()
  @IsArray()
  addScriptTag?: ScriptTagOptions[];

  @ApiPropertyOptional({ description: "Inject style tags before capturing", type: [Object] })
  @IsOptional()
  @IsArray()
  addStyleTag?: StyleTagOptions[];

  @ApiPropertyOptional({ description: "Enable or disable JavaScript" })
  @IsOptional()
  @IsBoolean()
  setJavaScriptEnabled?: boolean;

  @ApiPropertyOptional({ description: "CSS media type emulation (e.g. 'screen', 'print')" })
  @IsOptional()
  @IsString()
  emulateMediaType?: string;
}
