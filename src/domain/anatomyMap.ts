import type { RegionId } from "@/domain/types";

const RULES: [RegExp, RegionId, string][] = [
  [/achilles|calcaneal tendon|tendon of triceps surae/, "achilles", "阿基里斯腱"],
  [/plantar|plantar aponeurosis|flexor digitorum brevis|abductor hallucis|quadratus plantae|flexor hallucis brevis|adductor hallucis/, "plantar", "足底"],
  [/extensor digitorum brevis|extensor hallucis brevis/, "dorsum_foot", "足背"],
  [/calcaneus|calcaneal/, "heel", "腳跟"],
  [/medial malleol/, "med_ankle", "內踝"],
  [/lateral malleol|fibula|fibular/, "lat_ankle", "外踝／腓骨"],
  [/patella|patellar/, "ant_knee", "膝蓋"],
  [/poplite/, "post_knee", "膝後"],
  [/iliotibial/, "lat_knee", "髂脛束"],
  [/medial condyle of femur|medial condyle of tibia|medial meniscus/, "med_knee", "膝內側"],
  [/lateral condyle of femur|lateral condyle of tibia|lateral meniscus/, "lat_knee", "膝外側"],
  [/gastrocnemius|soleus|plantaris/, "post_calf", "小腿肚"],
  [/tibialis anterior|extensor digitorum longus|extensor hallucis longus/, "ant_shin", "小腿前面"],
  [/tibialis posterior|flexor digitorum longus|flexor hallucis longus/, "post_calf", "小腿深層"],
  [/medial surface of tibia|medial border of tibia|tibia/, "med_tibia", "脛骨"],
  [/vastus lateralis|vastus medialis|vastus intermedius|rectus femoris|quadriceps|sartorius/, "ant_thigh", "大腿前面"],
  [/biceps femoris|semimembranosus|semitendinosus|hamstring/, "post_thigh", "大腿後面"],
  [/adductor|gracilis|pectineus/, "med_thigh", "大腿內側"],
  [/gluteus medius|gluteus minimus|tensor fasciae/, "lat_hip", "臀外側"],
  [/gluteus maximus|piriformis|gemellus|obturator|quadratus femoris/, "deep_glute", "臀深層"],
  [/iliacus|psoas|iliopsoas/, "groin", "髂腰肌／鼠蹊"],
  [/femur/, "ant_thigh", "股骨"],
  [/pectoralis/, "upper_back", "胸肌"],
  [/trapezius|rhomboid|latissimus|serratus posterior|thoracic vertebra|scapula/, "upper_back", "上背"],
  [/deltoid|supraspinatus|infraspinatus|subscapularis|teres major|teres minor|clavicle|humerus/, "shoulder", "肩"],
  [/biceps brachii|triceps|brachialis|brachioradialis|anconeus|olecranon/, "elbow", "肘"],
  [/carpi|carpal|pollicis|pronator|supinator|radius|ulna|metacarpal/, "wrist", "前臂／手腕"],
  [/linea alba|rectus abdominis|abdominal oblique|transversus abdominis|external abdominal|internal abdominal/, "low_back", "腹部"],
  [/quadratus lumborum|iliocostalis lumborum|lumbar|multifidus|erector/, "low_back", "下背"],
  [/sternocleidomastoid|splenius|scalen|cervical|hyoid|semispinalis colli/, "neck", "頸"],
  [/ilium|ischium|pelvis|hip bone/, "lat_hip", "髖骨"],
  [/pubis/, "groin", "恥骨"],
  [/sacrum|coccyx/, "low_back", "骶骨"],
];

export function mapAnatomy(displayName: string, extra = ""): { regionId: RegionId; labelZh: string } {
  const text = `${displayName} ${extra}`.toLowerCase();
  for (const [pattern, regionId, labelZh] of RULES) {
    if (pattern.test(text)) return { regionId, labelZh };
  }
  const clean = displayName.trim();
  return { regionId: "upper_back", labelZh: clean || "未命名結構" };
}
