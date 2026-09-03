export const MASTERCLASS_TOPICS = [
  "Комплексный уход за кожей и антивозрастные программы Halo Complex",
  "Оздоровительные соли и грязевые аппликации Мертвого моря",
  "Динамический крем и Солярис: домашняя аптечка первой помощи",
  "Индивидуальный подбор продукции и дегустация текстур",
  "Общая презентация оздоровительной линии Dr. Nona",
] as const;

export type MasterclassTopic = (typeof MASTERCLASS_TOPICS)[number];

export const MASTERCLASS_TOPIC_LABELS_RO: Record<MasterclassTopic, string> = {
  "Комплексный уход за кожей и антивозрастные программы Halo Complex":
    "Îngrijirea complexă a pielii și programele anti-îmbătrânire Halo Complex",
  "Оздоровительные соли и грязевые аппликации Мертвого моря":
    "Sărurile pentru bunăstare și aplicațiile cu nămol de la Marea Moartă",
  "Динамический крем и Солярис: домашняя аптечка первой помощи":
    "Dynamic Cream și Solaris: trusa de prim ajutor pentru acasă",
  "Индивидуальный подбор продукции и дегустация текстур": "Selectarea individuală a produselor și testarea texturilor",
  "Общая презентация оздоровительной линии Dr. Nona": "Prezentarea generală a gamei pentru bunăstare Dr. Nona",
};
