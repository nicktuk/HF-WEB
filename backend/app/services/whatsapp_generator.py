"""Service for WhatsApp message generation."""
from typing import List, Optional
from urllib.parse import quote
from sqlalchemy.orm import Session
from app.models.product import Product

# Configuración
WHATSAPP_NUMBER = "5491133240285"
CATALOG_URL = "https://www.hefaproductos.com.ar"


class WhatsAppMessageGenerator:
    """Generate WhatsApp messages for product promotion."""

    def __init__(self, db: Session):
        self.db = db

    def get_filtered_products(
        self,
        is_featured: Optional[bool] = None,
        is_immediate_delivery: Optional[bool] = None,
        is_best_seller: Optional[bool] = None,
        category: Optional[str] = None,
        limit: int = 20
    ) -> List[Product]:
        """Get products filtered by badges for message generation."""
        query = self.db.query(Product).filter(Product.enabled == True)

        if is_featured is not None:
            query = query.filter(Product.is_featured == is_featured)
        if is_immediate_delivery is not None:
            query = query.filter(Product.is_immediate_delivery == is_immediate_delivery)
        if is_best_seller is not None:
            query = query.filter(Product.is_best_seller == is_best_seller)
        if category:
            query = query.filter(Product.category == category)

        return query.order_by(Product.updated_at.desc()).limit(limit).all()

    def _format_price(self, price: Optional[int]) -> str:
        """Format price with thousand separators."""
        if not price:
            return "Consultar"
        return f"${price:,.0f}".replace(",", ".")

    def _generate_wa_link_short(self) -> str:
        """Generate short WhatsApp link for message text."""
        return f"https://wa.me/{WHATSAPP_NUMBER}"

    def _generate_wa_link_full(self, product_name: str, price: Optional[int], slug: str) -> str:
        """Generate full WhatsApp link with pre-filled message for button."""
        message = f"Hola! Me interesa el producto: {product_name}"
        if price:
            message += f" (${price:,.0f})".replace(",", ".")
        message += f"\n\nVi el producto en: {CATALOG_URL}/producto/{slug}"
        encoded_message = quote(message)
        return f"https://wa.me/{WHATSAPP_NUMBER}?text={encoded_message}"

    def generate_message(
        self,
        product: Product,
        template: str = "default",
        include_price: bool = True,
        custom_text: Optional[str] = None
    ) -> dict:
        """
        Generate WhatsApp message for a single product.

        Returns:
            Dict with 'text', 'image_url', 'product_id', 'product_name', 'wa_link'
        """
        display_name = product.custom_name or product.original_name
        price = product.final_price

        # Get primary image
        image_url = None
        for img in product.images:
            if img.is_primary:
                image_url = img.url
                break
        if not image_url and product.images:
            image_url = product.images[0].url

        text = self._build_message_text(
            display_name=display_name,
            price=price,
            short_description=product.short_description,
            is_featured=product.is_featured,
            is_immediate_delivery=product.is_immediate_delivery,
            is_best_seller=product.is_best_seller,
            template=template,
            include_price=include_price,
            custom_text=custom_text,
            slug=product.slug
        )

        wa_link = self._generate_wa_link_full(display_name, price, product.slug)

        return {
            "text": text,
            "image_url": image_url,
            "product_id": product.id,
            "product_name": display_name,
            "wa_link": wa_link
        }

    def _build_message_text(
        self,
        display_name: str,
        price: Optional[int],
        short_description: Optional[str],
        is_featured: bool,
        is_immediate_delivery: bool,
        is_best_seller: bool,
        template: str,
        include_price: bool,
        custom_text: Optional[str],
        slug: str
    ) -> str:
        """Build message text based on template."""

        if template == "custom" and custom_text:
            text = custom_text.replace("{product_name}", display_name)
            text = text.replace("{price}", self._format_price(price) if price else "Consultar")
            return text

        if template == "nuevos":
            text = "✨ *NUEVO EN CATÁLOGO* ✨\n\n"
            text += f"📦 *{display_name}*\n\n"
            if short_description:
                text += f"_{short_description}_\n\n"
            if include_price and price:
                text += f"💰 *Precio: {self._format_price(price)}*\n\n"
            text += "━━━━━━━━━━━━━━━\n"
            text += "📲 *Consultanos por WhatsApp!*\n"
            text += f"👉 {self._generate_wa_link_short()}"
            return text

        if template == "mas_vendidos":
            text = "🔥 *LO MÁS VENDIDO* 🔥\n\n"
            text += f"⭐ *{display_name}*\n\n"
            if short_description:
                text += f"_{short_description}_\n\n"
            if include_price and price:
                text += f"💰 *Precio: {self._format_price(price)}*\n\n"
            text += "━━━━━━━━━━━━━━━\n"
            text += "🏃 *No te quedes sin el tuyo!*\n"
            text += f"👉 {self._generate_wa_link_short()}"
            return text

        if template == "promo":
            text = "🎉 *OFERTA ESPECIAL* 🎉\n\n"
            text += f"🎁 *{display_name}*\n\n"
            if include_price and price:
                text += f"💥 *Solo {self._format_price(price)}*\n\n"
            text += "━━━━━━━━━━━━━━━\n"
            text += "⏰ *No te lo pierdas!*\n"
            text += f"👉 {self._generate_wa_link_short()}"
            return text

        # Default template
        text = f"📦 *{display_name}*\n\n"

        if short_description:
            text += f"_{short_description}_\n\n"

        if include_price and price:
            text += f"💰 *Precio: {self._format_price(price)}*\n\n"

        # Add badges with emojis
        badges = []
        if is_featured:
            badges.append("✨ NUEVO")
        if is_immediate_delivery:
            badges.append("🚀 Entrega Inmediata")
        if is_best_seller:
            badges.append("🔥 Lo Más Vendido")

        if badges:
            text += " • ".join(badges) + "\n\n"

        text += "━━━━━━━━━━━━━━━\n"
        text += "📲 *Consultanos por WhatsApp!*\n"
        text += f"👉 {self._generate_wa_link_short()}"

        return text

    def generate_bulk_message(
        self,
        products: List[Product],
        template: str = "default",
        include_price: bool = True,
        custom_text: Optional[str] = None
    ) -> dict:
        """
        Generate a single combined WhatsApp message for multiple products.

        Returns:
            Dict with 'text', 'images', 'product_count'
        """
        if not products:
            return {"text": "", "images": [], "product_count": 0}

        # Build header based on template
        if template == "nuevos":
            header = "✨ *NUEVOS EN CATÁLOGO* ✨\n\n"
        elif template == "mas_vendidos":
            header = "🔥 *LO MÁS VENDIDO DE LA SEMANA* 🔥\n\n"
        elif template == "promo":
            header = "🎉 *OFERTAS ESPECIALES* 🎉\n\n"
        else:
            header = "⭐ *PRODUCTOS DESTACADOS* ⭐\n\n"

        lines = [header]
        images = []

        for i, product in enumerate(products, 1):
            display_name = product.custom_name or product.original_name
            price = product.final_price

            emoji = "📦" if i % 2 == 0 else "🎁"
            line = f"{emoji} *{display_name}*"
            if include_price and price:
                line += f" — {self._format_price(price)}"
            lines.append(line)

            # Collect images
            image_url = None
            for img in product.images:
                if img.is_primary:
                    image_url = img.url
                    break
            if not image_url and product.images:
                image_url = product.images[0].url

            if image_url:
                images.append({
                    "product_id": product.id,
                    "product_name": display_name,
                    "image_url": image_url
                })

        lines.append("\n━━━━━━━━━━━━━━━")
        lines.append("📲 *Consultanos por cualquiera!*")
        lines.append(f"👉 https://wa.me/{WHATSAPP_NUMBER}")
        lines.append(f"\n🌐 Ver catálogo: {CATALOG_URL}")

        return {
            "text": "\n".join(lines),
            "images": images,
            "product_count": len(products)
        }

    def generate_messages(
        self,
        product_ids: List[int],
        template: str = "default",
        include_price: bool = True,
        custom_text: Optional[str] = None
    ) -> List[dict]:
        """Generate individual messages for multiple products."""
        products = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).all()

        return [
            self.generate_message(product, template, include_price, custom_text)
            for product in products
        ]
