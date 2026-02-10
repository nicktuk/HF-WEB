"""PDF Generation Service for product catalog."""
import io
import os
import httpx
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image,
    Table, TableStyle, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus.frames import Frame
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate

from app.models.product import Product
from app.config import settings


# Brand colors
BRAND_PRIMARY = '#2563eb'  # Blue
BRAND_SECONDARY = '#1e40af'  # Darker blue
BRAND_ACCENT = '#16a34a'  # Green for prices
WHATSAPP_GREEN = '#25D366'


def _format_whatsapp_display(number: str) -> str:
    """Format WhatsApp number for display in PDF."""
    # Format: 5492274402761 -> +54 9 2274 40-2761
    if number.startswith("549"):
        return f"+54 9 {number[3:7]} {number[7:9]}-{number[9:]}"
    return number


def _header_footer(canvas, doc):
    """Add modern header and footer to each page."""
    canvas.saveState()
    page_width = A4[0]
    page_height = A4[1]

    # ===== HEADER =====
    # Header background bar (gradient effect with two colors)
    canvas.setFillColor(colors.HexColor(BRAND_PRIMARY))
    canvas.rect(0, page_height - 2.2*cm, page_width, 2.2*cm, fill=1, stroke=0)

    # Accent stripe at bottom of header
    canvas.setFillColor(colors.HexColor(BRAND_SECONDARY))
    canvas.rect(0, page_height - 2.2*cm, page_width, 0.15*cm, fill=1, stroke=0)

    # Brand name - large and bold
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 20)
    canvas.drawString(2*cm, page_height - 1.5*cm, "HeFa - Productos")

    # WhatsApp button style (rounded rectangle)
    whatsapp_x = page_width - 6.8*cm
    whatsapp_y = page_height - 1.7*cm
    canvas.setFillColor(colors.HexColor(WHATSAPP_GREEN))
    canvas.roundRect(whatsapp_x, whatsapp_y, 5*cm, 0.9*cm, 0.2*cm, fill=1, stroke=0)

    # WhatsApp icon circle
    canvas.setFillColor(colors.white)
    canvas.circle(whatsapp_x + 0.5*cm, whatsapp_y + 0.45*cm, 0.25*cm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor(WHATSAPP_GREEN))
    canvas.setFont('Helvetica-Bold', 7)
    canvas.drawCentredString(whatsapp_x + 0.5*cm, whatsapp_y + 0.35*cm, "W")

    # WhatsApp number
    canvas.setFillColor(colors.white)
    canvas.setFont('Helvetica-Bold', 11)
    canvas.drawString(whatsapp_x + 0.9*cm, whatsapp_y + 0.28*cm, _format_whatsapp_display(settings.WHATSAPP_NUMBER))

    # ===== FOOTER =====
    # Footer accent line
    canvas.setStrokeColor(colors.HexColor(BRAND_PRIMARY))
    canvas.setLineWidth(2)
    canvas.line(2*cm, 2.2*cm, page_width - 2*cm, 2.2*cm)

    # CTA phrase - LARGE and attention-grabbing
    canvas.setFillColor(colors.HexColor(BRAND_PRIMARY))
    canvas.setFont('Helvetica-Bold', 14)
    canvas.drawCentredString(page_width / 2, 1.5*cm, "¿No encontrás lo que buscás? ¡Consultanos!")

    # WhatsApp reminder in footer
    canvas.setFillColor(colors.HexColor(WHATSAPP_GREEN))
    canvas.setFont('Helvetica-Bold', 10)
    canvas.drawCentredString(page_width / 2, 0.9*cm, f"WhatsApp: {_format_whatsapp_display(settings.WHATSAPP_NUMBER)}")

    # Date - small on the left
    today = datetime.now().strftime("%d/%m/%Y")
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#9ca3af'))
    canvas.drawString(2*cm, 0.5*cm, f"Precios al {today}")

    # Page number - subtle on the right
    page_num = canvas.getPageNumber()
    canvas.drawRightString(page_width - 2*cm, 0.5*cm, f"Pagina {page_num}")

    canvas.restoreState()


class PDFGeneratorService:
    """Service for generating PDF catalogs."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom paragraph styles with modern marketing aesthetics."""
        # Product name - bold and attention-grabbing
        self.styles.add(ParagraphStyle(
            name='ProductTitle',
            parent=self.styles['Heading2'],
            fontSize=13,
            spaceAfter=4,
            textColor=colors.HexColor('#1f2937'),
            fontName='Helvetica-Bold',
            wordWrap='CJK',
        ))
        # Product description - readable and clean
        self.styles.add(ParagraphStyle(
            name='ProductDescription',
            parent=self.styles['Normal'],
            fontSize=9,
            spaceAfter=6,
            textColor=colors.HexColor('#6b7280'),
            wordWrap='CJK',
            leading=12,
        ))
        # Price - BIG and green (calls attention)
        self.styles.add(ParagraphStyle(
            name='ProductPrice',
            parent=self.styles['Normal'],
            fontSize=18,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor(BRAND_ACCENT),
            spaceAfter=8,
        ))
        # Main catalog title
        self.styles.add(ParagraphStyle(
            name='CatalogTitle',
            parent=self.styles['Title'],
            fontSize=28,
            spaceAfter=5,
            alignment=TA_CENTER,
            textColor=colors.HexColor(BRAND_PRIMARY),
            fontName='Helvetica-Bold',
        ))
        # Category header - prominent section divider
        self.styles.add(ParagraphStyle(
            name='CategoryHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            spaceBefore=15,
            spaceAfter=8,
            textColor=colors.white,
            fontName='Helvetica-Bold',
            backColor=colors.HexColor(BRAND_PRIMARY),
            borderPadding=(8, 12, 8, 12),
            keepWithNext=True,
        ))

    async def _fetch_image(self, url: str, max_width: float = 5*cm, max_height: float = 5*cm) -> Optional[Image]:
        """Fetch image from URL and return ReportLab Image object."""
        try:
            img_data = None

            # Check if it's a local upload - read directly from disk
            if '/uploads/' in url:
                # Extract the filename from the URL
                # URL format: http://localhost:8000/uploads/filename.jpg
                filename = url.split('/uploads/')[-1]
                # Get the uploads directory (relative to backend folder)
                uploads_dir = Path(__file__).parent.parent.parent / 'uploads'
                local_path = uploads_dir / filename

                if local_path.exists():
                    with open(local_path, 'rb') as f:
                        img_data = io.BytesIO(f.read())

            # If not local or local file not found, try HTTP
            if img_data is None:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(url)
                    if response.status_code == 200:
                        img_data = io.BytesIO(response.content)

            if img_data:
                img = Image(img_data)

                # Scale image to fit within max dimensions while maintaining aspect ratio
                aspect = img.imageWidth / img.imageHeight
                if aspect > 1:  # Wider than tall
                    img.drawWidth = min(max_width, img.imageWidth)
                    img.drawHeight = img.drawWidth / aspect
                else:  # Taller than wide
                    img.drawHeight = min(max_height, img.imageHeight)
                    img.drawWidth = img.drawHeight * aspect

                # Ensure it doesn't exceed max dimensions
                if img.drawHeight > max_height:
                    img.drawHeight = max_height
                    img.drawWidth = img.drawHeight * aspect
                if img.drawWidth > max_width:
                    img.drawWidth = max_width
                    img.drawHeight = img.drawWidth / aspect

                return img
        except Exception:
            pass
        return None

    def _format_price(self, price: float) -> str:
        """Format price for display."""
        return f"$ {price:,.0f}".replace(",", ".")

    def _truncate_text(self, text: str, max_length: int = 200) -> str:
        """Truncate text at word boundary."""
        if len(text) <= max_length:
            return text
        # Find last space before max_length
        truncated = text[:max_length]
        last_space = truncated.rfind(' ')
        if last_space > max_length * 0.7:  # Only use word boundary if reasonable
            truncated = truncated[:last_space]
        return truncated.rstrip() + "..."

    async def generate_catalog_pdf(
        self,
        products: List[Product],
        title: str = "Catalogo de Productos",
        include_images: bool = True,
    ) -> bytes:
        """
        Generate a PDF catalog with all enabled products.

        Args:
            products: List of Product objects to include
            title: Title for the catalog
            include_images: Whether to include product images

        Returns:
            PDF file as bytes
        """
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=2.8*cm,  # Space for header
            bottomMargin=2.8*cm,  # Space for footer CTA
        )

        story = []

        # ===== TITLE SECTION =====
        story.append(Paragraph(title, self.styles['CatalogTitle']))
        story.append(Spacer(1, 20))

        # Separate featured products (Novedades)
        featured_products = [p for p in products if p.is_featured]

        # Group all products by category
        products_by_category = {}
        for product in products:
            category = product.category or "Otros productos"
            if category not in products_by_category:
                products_by_category[category] = []
            products_by_category[category].append(product)

        # First: Show "Nuevo" section if there are featured products
        if featured_products:
            category_header = self._create_category_header("Nuevo")

            for i, product in enumerate(featured_products):
                product_elements = await self._create_product_entry(product, include_images)

                if i == 0:
                    story.append(KeepTogether([category_header, Spacer(1, 8)] + product_elements))
                else:
                    story.append(KeepTogether(product_elements))

                story.append(Spacer(1, 12))

        # Then: Generate content for each regular category
        for category, category_products in sorted(products_by_category.items()):
            # Category header
            category_header = self._create_category_header(category)

            for i, product in enumerate(category_products):
                product_elements = await self._create_product_entry(product, include_images)

                if i == 0:
                    # Keep category header with first product
                    story.append(KeepTogether([category_header, Spacer(1, 8)] + product_elements))
                else:
                    # Keep product entry together on same page if possible
                    story.append(KeepTogether(product_elements))

                story.append(Spacer(1, 12))

        doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    async def generate_wholesale_selected_pdf(
        self,
        products: List[Product],
        title: str = "Lista Mayorista",
    ) -> bytes:
        """
        Generate a PDF with medium images, full name, and wholesale price.
        """
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=2.8*cm,
            bottomMargin=2.8*cm,
        )

        story = []
        story.append(Paragraph(title, self.styles['CatalogTitle']))
        story.append(Spacer(1, 16))

        cell_style = ParagraphStyle(
            name='WholesaleCell',
            parent=self.styles['Normal'],
            fontSize=10,
            wordWrap='CJK',
            leading=13,
            textColor=colors.HexColor('#111827'),
        )
        price_style = ParagraphStyle(
            name='WholesalePrice',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor(BRAND_ACCENT),
            alignment=TA_RIGHT,
        )
        header_style = ParagraphStyle(
            name='WholesaleHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.white,
        )

        table_data = [[
            Paragraph('Foto', header_style),
            Paragraph('Producto', header_style),
            Paragraph('Precio mayorista', header_style),
        ]]

        for product in products:
            name = product.custom_name or product.original_name
            wholesale_price = None
            if product.original_price is not None:
                wholesale_price = float(product.original_price) * (1 + float(product.wholesale_markup_percentage or 0) / 100)
            price_text = self._format_price(wholesale_price) if wholesale_price else "-"

            img = None
            if product.images:
                primary = next((i for i in product.images if i.is_primary), product.images[0])
                img = await self._fetch_image(primary.url, max_width=4*cm, max_height=4*cm)

            table_data.append([
                img if img else Paragraph('-', cell_style),
                Paragraph(name, cell_style),
                Paragraph(price_text, price_style),
            ])

        table = Table(table_data, colWidths=[4*cm, 10*cm, 3.5*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(BRAND_PRIMARY)),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('LEFTPADDING', (0, 0), (-1, 0), 8),
            ('RIGHTPADDING', (0, 0), (-1, 0), 8),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('VALIGN', (0, 1), (0, -1), 'MIDDLE'),
            ('VALIGN', (1, 1), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#e5e7eb')),
        ]))

        story.append(table)

        doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes

    def _create_category_header(self, text: str):
        """Create a visually prominent category header."""
        # Create a table with colored background for the category
        header_style = ParagraphStyle(
            name='CategoryText',
            parent=self.styles['Normal'],
            fontSize=14,
            fontName='Helvetica-Bold',
            textColor=colors.white,
            leading=18,
        )
        content = Paragraph(text, header_style)
        table = Table([[content]], colWidths=[17*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(BRAND_PRIMARY)),
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 15),
            ('ROUNDEDCORNERS', [5, 5, 5, 5]),
        ]))
        return table

    async def _create_product_entry(self, product: Product, include_images: bool) -> List:
        """Create elements for a single product entry with modern card-like design."""
        elements = []

        # Get product name and price
        name = product.custom_name or product.original_name
        price = product.final_price
        description = product.short_description or ""
        brand = product.brand

        # Create product info section
        if include_images and product.images:
            # Get primary image
            primary_image = None
            for img in product.images:
                if img.is_primary:
                    primary_image = img
                    break
            if not primary_image and product.images:
                primary_image = product.images[0]

            if primary_image:
                img = await self._fetch_image(primary_image.url, max_width=4.5*cm, max_height=4.5*cm)
                if img:
                    # Create text content
                    text_content = []
                    text_content.append(Paragraph(name, self.styles['ProductTitle']))

                    # Brand if available (subtle)
                    if brand:
                        brand_style = ParagraphStyle(
                            name='Brand',
                            parent=self.styles['Normal'],
                            fontSize=8,
                            textColor=colors.HexColor('#9ca3af'),
                            spaceAfter=4,
                        )
                        text_content.append(Paragraph(f"Marca: {brand}", brand_style))

                    if description:
                        text_content.append(Paragraph(
                            self._truncate_text(description, 150),
                            self.styles['ProductDescription']
                        ))

                    if price:
                        text_content.append(Spacer(1, 5))
                        text_content.append(Paragraph(
                            self._format_price(price),
                            self.styles['ProductPrice']
                        ))

                    # Build table with image on left, text on right
                    table_data = [[img, text_content]]
                    table = Table(table_data, colWidths=[5*cm, 12*cm])
                    table.setStyle(TableStyle([
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                        ('LEFTPADDING', (0, 0), (0, 0), 5),
                        ('RIGHTPADDING', (0, 0), (0, 0), 15),
                        ('LEFTPADDING', (1, 0), (1, 0), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                        # Subtle card border
                        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
                    ]))
                    elements.append(table)
                    return elements

        # Fallback: text only (card style)
        text_content = []
        text_content.append(Paragraph(name, self.styles['ProductTitle']))
        if brand:
            brand_style = ParagraphStyle(
                name='BrandOnly',
                parent=self.styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#9ca3af'),
                spaceAfter=4,
            )
            text_content.append(Paragraph(f"Marca: {brand}", brand_style))
        if description:
            text_content.append(Paragraph(
                self._truncate_text(description, 150),
                self.styles['ProductDescription']
            ))
        if price:
            text_content.append(Spacer(1, 5))
            text_content.append(Paragraph(self._format_price(price), self.styles['ProductPrice']))

        # Wrap in a subtle card
        table = Table([[text_content]], colWidths=[17*cm])
        table.setStyle(TableStyle([
            ('TOPPADDING', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fafafa')),
        ]))
        elements.append(table)

        return elements

    async def generate_simple_catalog_pdf(
        self,
        products: List[Product],
        title: str = "Lista de Precios",
    ) -> bytes:
        """
        Generate a simple price list PDF (no images, compact format).

        Args:
            products: List of Product objects
            title: Title for the document

        Returns:
            PDF file as bytes
        """
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=2.8*cm,
            bottomMargin=2.8*cm,
        )

        story = []

        # Title section
        story.append(Paragraph(title, self.styles['CatalogTitle']))
        story.append(Spacer(1, 20))

        # Style for table cells with word wrap
        cell_style = ParagraphStyle(
            name='TableCell',
            parent=self.styles['Normal'],
            fontSize=9,
            wordWrap='CJK',
            leading=13,
            textColor=colors.HexColor('#374151'),
        )
        price_style = ParagraphStyle(
            name='TableCellPrice',
            parent=self.styles['Normal'],
            fontSize=10,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor(BRAND_ACCENT),
            alignment=TA_RIGHT,
        )
        header_style = ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=11,
            fontName='Helvetica-Bold',
            textColor=colors.white,
        )

        # Create table data with Paragraphs for proper word wrapping
        table_data = [[
            Paragraph('Producto', header_style),
            Paragraph('Precio', header_style)
        ]]

        for product in products:
            name = product.custom_name or product.original_name
            price = self._format_price(product.final_price) if product.final_price else "-"

            table_data.append([
                Paragraph(name, cell_style),
                Paragraph(price, price_style)
            ])

        # Create table with modern styling
        table = Table(table_data, colWidths=[14*cm, 3*cm])
        table.setStyle(TableStyle([
            # Header - branded color
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(BRAND_PRIMARY)),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TOPPADDING', (0, 0), (-1, 0), 12),
            ('LEFTPADDING', (0, 0), (-1, 0), 10),

            # Body
            ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 10),
            ('LEFTPADDING', (0, 1), (-1, -1), 10),

            # Alternating row colors
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),

            # Subtle grid
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('LINEABOVE', (0, 0), (-1, 0), 0, colors.white),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor(BRAND_PRIMARY)),

            # Alignment
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))

        story.append(table)

        doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        return pdf_bytes
