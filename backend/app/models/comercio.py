"""
Comercio models - Canal comercios: vendedores, comercios, configuracion y pedidos.
Las tablas DB conservan sus nombres originales (mayoristas, pedidos_mayoristas, etc.)
"""
import enum
import sqlalchemy as sa
from sqlalchemy import Column, Integer, Boolean, Numeric, ForeignKey, Text, DateTime, Date, String, Enum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.models.base import Base


class EstadoComercio(str, enum.Enum):
    pendiente = 'pendiente'
    activo = 'activo'
    rechazado = 'rechazado'
    suspendido = 'suspendido'


class EstadoPedidoComercio(str, enum.Enum):
    recibido = 'recibido'
    confirmado = 'confirmado'
    preparando = 'preparando'
    entregado = 'entregado'
    entrega_parcial = 'entrega_parcial'
    cancelado = 'cancelado'


class EstadoPagoPedidoComercio(str, enum.Enum):
    pendiente = 'pendiente'
    pagado = 'pagado'


class EstadoComision(str, enum.Enum):
    pendiente = 'pendiente'
    liquidada = 'liquidada'


class ModalidadPagoComercio(str, enum.Enum):
    normal = 'normal'
    anticipado = 'anticipado'


class EstadoProspecto(str, enum.Enum):
    interesado = 'interesado'
    lo_pienso = 'lo_pienso'
    no_va = 'no_va'
    convertido = 'convertido'


class Comercio(Base):
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
    rubro = Column(Text, nullable=True, comment="Rubro del comercio (ej: Bazar, Ferretería)")
    rubros_interes = Column(ARRAY(Text), nullable=True, comment="Categorías del catálogo que le interesaría comprar")
    estado = Column(
        Enum('pendiente', 'activo', 'rechazado', 'suspendido',
             name='estado_mayorista_enum', create_type=False),
        nullable=False,
        default='pendiente',
    )
    vendedor_id = Column(Integer, ForeignKey("catalog_sellers.id", ondelete="SET NULL"), nullable=True)
    activado_at = Column(DateTime, nullable=True)
    reset_token_hash = Column(Text, nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    debe_cambiar_password = Column(Boolean, nullable=False, default=False)
    # 'anticipado': tras 2 pedidos cancelados por vencimiento de la ventana de
    # reserva (48hs sin pago), se le exige pagar por adelantado.
    modalidad_pago = Column(
        Enum('normal', 'anticipado', name='modalidad_pago_mayorista_enum', create_type=False),
        nullable=False,
        default='normal',
    )

    vendedor = relationship("CatalogSeller", back_populates="comercios")
    pedidos = relationship("PedidoComercio", back_populates="comercio")


class ConfiguracionComercio(Base):
    __tablename__ = "configuracion_mayorista"

    id = Column(Integer, primary_key=True)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False, default=25)
    redondeo = Column(Integer, nullable=False, default=100)
    monto_minimo_pedido = Column(Numeric(12, 2), nullable=False, default=0)
    # 'fijo': usar descuento_porcentaje sobre precio_compra
    # 'variable': mitad del markup actual del producto (promedio entre compra y venta)
    tipo_markup = Column(sa.String(10), nullable=False, default='fijo')
    # Si True: incluye en el catálogo todos los productos habilitados con stock > 0 y markup > 50%
    mostrar_todos_con_stock = Column(Boolean, nullable=False, default=False)
    # 'markup': precio_comercio se calcula sobre el costo de compra (tipo_markup/descuento_porcentaje).
    # 'descuento': precio_comercio se calcula descontando un % (según comercio_descuento_tramos,
    # elegido por la cantidad pedida) sobre el precio minorista.
    modo_precio = Column(sa.String(10), nullable=False, default='markup')
    # Semáforo de actividad de recompra, calculado por días desde el último pedido
    # del comercio: verde (< amarillo), amarillo (>= amarillo y < rojo), rojo (>= rojo).
    semaforo_dias_amarillo = Column(Integer, nullable=False, default=7)
    semaforo_dias_rojo = Column(Integer, nullable=False, default=14)
    # Tasas de comisión del vendedor, configurables desde el admin (antes
    # hardcodeadas). Mayorista distingue cliente nuevo vs. recompra; minorista
    # es una sola tasa (default 0 = apagada hasta que se defina la regla).
    comision_mayorista_nuevo_porcentaje = Column(Numeric(5, 2), nullable=False, default=15)
    comision_mayorista_recompra_porcentaje = Column(Numeric(5, 2), nullable=False, default=10)
    comision_minorista_porcentaje = Column(Numeric(5, 2), nullable=False, default=0)


class DescuentoTramoComercio(Base):
    """Tramo de la matriz cantidad/descuento usada cuando modo_precio == 'descuento'.

    A partir de `cantidad_minima` unidades de un mismo producto en el pedido,
    se aplica `descuento_porcentaje` sobre el precio minorista. Se usa siempre
    el tramo de mayor cantidad_minima que la cantidad pedida alcance.
    """
    __tablename__ = "comercio_descuento_tramos"

    id = Column(Integer, primary_key=True)
    cantidad_minima = Column(Integer, nullable=False, unique=True)
    descuento_porcentaje = Column(Numeric(5, 2), nullable=False)


class PedidoComercio(Base):
    __tablename__ = "pedidos_mayoristas"

    id = Column(Integer, primary_key=True, index=True)
    # columna DB: mayorista_id — atributo Python: comercio_id
    comercio_id = Column('mayorista_id', Integer, ForeignKey("mayoristas.id", ondelete="RESTRICT"), nullable=False, index=True)
    vendedor_nombre = Column(Text, nullable=True)
    vendedor_celular_wa = Column(Text, nullable=True)
    estado = Column(
        Enum('recibido', 'confirmado', 'preparando', 'entregado', 'entrega_parcial', 'cancelado',
             name='estado_pedido_mayorista_enum', create_type=False),
        nullable=False,
        default='recibido',
    )
    total = Column(Numeric(12, 2), nullable=False, default=0)
    notas = Column(Text, nullable=True)
    modificado_at = Column(DateTime, nullable=True)
    modificado_por = Column(Text, nullable=True)
    estado_pago = Column(
        Enum('pendiente', 'pagado', name='estado_pago_pedido_mayorista_enum', create_type=False),
        nullable=False,
        default='pendiente',
    )
    metodo_pago = Column(Text, nullable=True)
    foto_entrega_url = Column(Text, nullable=True)
    # Ventana de 48hs desde que se confirma: si sigue sin pago al vencer,
    # el autocancelador lo pasa a 'cancelado' y marca cancelado_por_vencimiento.
    fecha_reserva_hasta = Column(DateTime, nullable=True)
    cancelado_por_vencimiento = Column(Boolean, nullable=False, default=False)
    # Override manual de la comisión del vendedor para este pedido puntual —
    # a lo sumo uno de los dos, pisa la tasa configurada en el admin
    # (nuevo/recompra). Ver services/comisiones.py.
    comision_porcentaje_manual = Column(Numeric(5, 2), nullable=True)
    comision_monto_manual = Column(Numeric(12, 2), nullable=True)

    comercio = relationship("Comercio", back_populates="pedidos")
    items = relationship("PedidoComercioItem", back_populates="pedido", cascade="all, delete-orphan")
    comision = relationship("Comision", back_populates="pedido", uselist=False)


class PedidoComercioItem(Base):
    __tablename__ = "pedidos_mayoristas_items"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_mayoristas.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    nombre_producto = Column(Text, nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    precio_original = Column(Numeric(12, 2), nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=False)
    cantidad_entregada = Column(Integer, nullable=False, default=0)

    pedido = relationship("PedidoComercio", back_populates="items")


class Comision(Base):
    """Comisión del vendedor por una venta pagada — mayorista (pedido_id) o
    minorista (sale_id). Exactamente uno de los dos está seteado (se valida
    en Python, no hay CHECK en DB). Se crea una única vez por pedido/venta
    (índices únicos en cada columna). El monto/tasa se calcula con la
    configuración vigente al momento del pago, pero un admin puede
    editarlos después a mano para un caso puntual (ver
    PATCH /admin/comisiones/{id})."""
    __tablename__ = "comisiones"

    id = Column(Integer, primary_key=True, index=True)
    vendedor_id = Column(Integer, ForeignKey("catalog_sellers.id", ondelete="RESTRICT"), nullable=False, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos_mayoristas.id", ondelete="CASCADE"), nullable=True, unique=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=True, unique=True)
    # Liquidación semanal que la pagó (ver LiquidacionComision). Mientras sea
    # NULL la comisión está pendiente; estado='liquidada' se mantiene en
    # sincronía para no romper los lugares que ya filtran por estado.
    liquidacion_id = Column(
        Integer, ForeignKey("liquidaciones_comision.id", ondelete="SET NULL"), nullable=True, index=True
    )
    base = Column(Numeric(12, 2), nullable=False)
    tasa = Column(Numeric(5, 4), nullable=False)
    monto = Column(Numeric(12, 2), nullable=False)
    estado = Column(
        Enum('pendiente', 'liquidada', name='estado_comision_enum', create_type=False),
        nullable=False,
        default='pendiente',
    )

    vendedor = relationship("CatalogSeller")
    pedido = relationship("PedidoComercio", back_populates="comision")
    sale = relationship("Sale", back_populates="comision")
    liquidacion = relationship("LiquidacionComision", back_populates="comisiones")


class LiquidacionComision(Base):
    """Pago de comisiones a un vendedor por una semana (lunes a domingo, hora
    Argentina) — ver services/liquidaciones.py. Una comisión pertenece a la
    semana en que se generó (Comision.created_at, que se graba al pagarse la
    venta/pedido). Puede haber más de una liquidación confirmada por
    vendedor y semana: las comisiones que aparecen después de liquidada una
    semana se pagan en una liquidación complementaria de esa misma semana.
    Anularla devuelve sus comisiones a pendiente y borra el gasto asociado."""
    __tablename__ = "liquidaciones_comision"

    id = Column(Integer, primary_key=True, index=True)
    vendedor_id = Column(Integer, ForeignKey("catalog_sellers.id", ondelete="RESTRICT"), nullable=False, index=True)
    semana_desde = Column(Date, nullable=False, index=True)
    semana_hasta = Column(Date, nullable=False)
    fecha_pago = Column(Date, nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    medio_pago = Column(String(100), nullable=True)
    notas = Column(Text, nullable=True)
    # 'confirmada' | 'anulada'
    estado = Column(String(20), nullable=False, default='confirmada')
    expense_id = Column(Integer, ForeignKey("expenses.id", ondelete="SET NULL"), nullable=True)

    vendedor = relationship("CatalogSeller")
    comisiones = relationship("Comision", back_populates="liquidacion")
    expense = relationship("Expense")


class VentaReportada(Base):
    """Registro de ventas de reventa reportadas por el comercio (o su vendedor),
    usado para medir actividad de recompra más allá de los pedidos a HEFA.
    No participa en el cálculo del semáforo (que se basa en pedidos_mayoristas);
    es información complementaria para el vendedor/admin.
    """
    __tablename__ = "venta_reportada"

    id = Column(Integer, primary_key=True, index=True)
    comercio_id = Column(Integer, ForeignKey("mayoristas.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    unidades_vendidas_desde_ultima = Column(Integer, nullable=False)
    fecha = Column(sa.Date, nullable=False)

    comercio = relationship("Comercio")


class Prospecto(Base):
    """Cartera de prospección de un vendedor: comercios visitados que todavía
    no son clientes. Al convertir, se crea el Comercio real y se linkea acá
    (comercio_id) para no perder el historial de contacto."""
    __tablename__ = "prospectos"

    id = Column(Integer, primary_key=True, index=True)
    vendedor_id = Column(Integer, ForeignKey("catalog_sellers.id", ondelete="CASCADE"), nullable=False, index=True)
    comercio_nombre = Column(Text, nullable=False)
    whatsapp = Column(Text, nullable=True)
    direccion = Column(Text, nullable=True)
    estado = Column(sa.String(20), nullable=False, default='interesado', index=True)
    fecha_proximo_contacto = Column(sa.Date, nullable=True)
    notas = Column(Text, nullable=True)
    comercio_id = Column(Integer, ForeignKey("mayoristas.id", ondelete="SET NULL"), nullable=True)

    vendedor = relationship("CatalogSeller")


class EstadoHistorial(Base):
    """Bitácora de transiciones de estado, para poder mostrarle al vendedor
    el flujo de fechas de un pedido/venta puntual (ver /vendedores/mis-ventas).
    `referencia_id` es el id de PedidoComercio (canal='mayorista') o de Sale
    (canal='minorista') — no hay FK porque apunta a una de dos tablas según
    el canal. Se escribe desde comercio_pedidos.py y services/sales.py cada
    vez que cambia el estado que le importa al vendedor; el punto de partida
    (creado/recibido) no vive acá, se sintetiza a partir de created_at."""
    __tablename__ = "estado_historial"

    id = Column(Integer, primary_key=True, index=True)
    canal = Column(sa.String(20), nullable=False, index=True)
    referencia_id = Column(Integer, nullable=False, index=True)
    estado = Column(Text, nullable=False)
    fecha = Column(DateTime, nullable=False, server_default=sa.func.now())
