export const REPORT_COLUMNS = {
  orders: {
    id: "ID заявки",
    createdAt: "Дата заявки (Кишинёв)",
    type: "Тип заявки",
    status: "Статус",
    firstName: "Имя клиента",
    lastName: "Фамилия клиента",
    phone: "Телефон",
    email: "Email",
    region: "Регион при заявке",
    products: "Товары",
    units: "Штук",
    retailTotal: "Сумма продажи, MDL",
    distributorTotal: "Сумма закупки, MDL",
    margin: "Разница, MDL",
    utmSource: "Источник UTM",
    isDemo: "Демонстрационная запись",
  },
  clients: {
    id: "ID клиента",
    firstName: "Имя",
    lastName: "Фамилия",
    phone: "Телефон",
    email: "Email",
    region: "Текущий регион",
    createdAt: "Дата создания (Кишинёв)",
    orderCount: "Заявок за период",
    doneCount: "Завершённых заказов за период",
    retailTotal: "Сумма завершённых заказов, MDL",
    lastOrderAt: "Последняя заявка за период",
  },
  products: {
    sku: "Артикул",
    name: "Товар",
    slug: "Код товара",
    orderCount: "Заказов с товаром",
    units: "Штук",
    retailTotal: "Сумма продажи, MDL",
    distributorTotal: "Сумма закупки, MDL",
    margin: "Разница, MDL",
    missingRetail: "Строк без цены продажи",
    missingCost: "Строк без цены закупки",
  },
  regions: {
    region: "Регион при заявке",
    orders: "Заявок",
    completed: "Завершённых заказов",
    retailTotal: "Сумма завершённых заказов, MDL",
    missingRetail: "Строк без цены продажи",
  },
} as const;

export type ReportType = keyof typeof REPORT_COLUMNS;

export const REPORT_LABELS: Record<ReportType, string> = {
  orders: "Заявки и заказы",
  clients: "Клиенты",
  products: "Товары и продажи",
  regions: "Регионы",
};

export const DEFAULT_REPORT_COLUMNS: Record<ReportType, readonly string[]> = {
  orders: ["id", "createdAt", "status", "firstName", "lastName", "phone", "region", "products", "units", "retailTotal"],
  clients: ["id", "firstName", "lastName", "phone", "region", "orderCount", "doneCount", "retailTotal"],
  products: ["sku", "name", "orderCount", "units", "retailTotal", "margin"],
  regions: ["region", "orders", "completed", "retailTotal"],
};
