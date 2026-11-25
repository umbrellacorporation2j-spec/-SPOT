const STEPS = [
  {
    title: "إضافة بث واحد",
    body: "اضغط «إضافة بث»، اكتب اسم المباراة والبطولة، والصق رابط البث. ستظهر معاينة فورية للرابط قبل الحفظ.",
  },
  {
    title: "الروابط المدعومة",
    body: "يدعم التطبيق روابط HLS (.m3u8) و MP4 وروابط يوتيوب (بث مباشر أو فيديو) وأي رابط تضمين رسمي.",
  },
  {
    title: "الإضافة الجماعية",
    body: "اختر تبويب «إضافة جماعية»، ثم الصق سطراً لكل بث بصيغة (الاسم | الرابط | البطولة) أو ارفع ملف M3U.",
  },
  {
    title: "المفضلة والعائلة",
    body: "احفظ بثوثك في المفضلة أو المتابعة، وأنشئ عائلة برمز دعوة لمشاركة المفضلات مع أفراد عائلتك.",
  },
];

export function HelpView() {
  return (
    <section className="space-y-3">
      <h2 className="spot-section-heading">كيف أضيف بثاً؟</h2>
      <div className="grid gap-3">
        {STEPS.map((s, idx) => (
          <div key={s.title} className="spot-card flex gap-3 p-4 ps-5">
            <span className="spot-slant flex h-8 w-8 flex-none items-center justify-center bg-primary text-sm font-bold text-primary-foreground">
              {idx + 1}
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="rounded-xl border-s-4 border-primary bg-card/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
        سبوت مشغّل للمباريات والبثوث. أضف الروابط التي تملك حق مشاهدتها وبثها.
      </p>
    </section>
  );
}