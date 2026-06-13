"""
Mayorista models - Canal mayorista: vendedores, mayoristas, configuracion y pedidos.
"""
import enum
from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from app.models.base import Base


class EstadoMayorista(str, enum.Enum):
    pendiente = 'pendiente'
    activo = 'activo'
    rechazado = 'rechazado'
    suspendido = 'suspendido'


class EstadoPedidoMayorista(str, enum.Enum):
    recibido = 'recibido'
    confirmado = 'confirmado'
    preparando = 'preparando'
    entregado = 'entregado'
    cancelado = 'cancelado'


class Vendedor(Base):
    __tablename__ = "vendedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(Text, nullable=False)
    celular_wa = Column(Text, nullable=False)
    email = Column(Text, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)

    mayoristas = relationship("Mayorista", back_populates="vendedor")


class Mayorista(Base):
    __tablename__ = "mayoristas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(Text, nullable=False)
    apellido = Column(Text, nullable=False)
    usuario = Column(Text, nullable=False, unique=True, index=True)
    password_hash = Column(Text, nullable=False)
    celular = Column(Text, nullable=True)
    email = Column(Text, nullable=True)
    nombre_local = Column(Text, nullable=False)
    ubicacion_local = Column(Text, nullable=False)
    estado = Column(
        Enum('pendiente', 'activo', 'rechazado', 'suspendido',
             name='estado_mayorista_enum', create_type=False),
        nullable=False,
        default='pendiente',
    )
    vendedor_id = Column(Integer, ForeignKey("vendedores.id", ondelete="SET NULL"), nullable=True)
    activado_at = Column(DateTime, nullable=True)

    vendedor = relationship("Vendedor", back_populates="mayoristas")
    pedidos = relationship("PedidoMayorista", back_populates="mayorista")


class ConfiguracionMayorista(Base):
    __tablename__ = "configuracion_mayorista"

    id = Column(Integer, primary_key=True)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=25)
    redondeo = Column(Integer, nullable=False, default=100)
    monto_minimo_pedido = Column(Numeric(12, 2), nullable=False, default=0)


class PedidoMayorista(Base):
    __tablename__ = "pedidos_mayoristas"

    id = Column(Integer, primary_key=True, index=True)
    mayorista_id = Column(Integer, ForeignKey("mayoristas.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendedor_nombre = Column(Text, nullable=True)
    vendedor_celular_wa = Column(Text, nullable=True)
    estado = Column(
        Enum('recibido', 'confirmado', 'preparando', 'entregado', 'cancelado',
             name='estado_pedido_mayorista_enum', create_type=False),
        nullable=False,
        default='recibido',
    )
    total = Column(Numeric(12, 2), nullable=False, default=0)
    notas = Column(Text, nullable=True)
    modificado_at = Column(DateTime, nullable=True)
    modificado_por = Column(Text, nullable=True)

    mayorista = relationship("Mayorista", back_populates="pedidos")
    items = relationship("PedidoMayoristaItem", back_populates="pedido", cascade="all, delete-orphan")


class PedidoMayoristaItem(Base):
    __tablename__ = "pedidos_mayoristas_items"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_mayoristas.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    nombre_producto = Column(Text, nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    precio_original = Column(Numeric(12, 2), nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=False)

    pedido = relationship("PedidoMayorista", back_populates="items")
