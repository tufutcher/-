// 个人月度创作分析：复用真实打卡、周报经验值与作品归档。
// 打卡天数合并实际打卡和周报代录，同一天只记一次。
import { summarizeXp } from "./weekly_xp.js";
import { buildArtworksFromCheckins, getArtworkCover } from "./artwork.js";

export function personalDateKey(value){
  const d = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return "";
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

export function personalMonthKey(date = new Date()){
  return personalDateKey(date).slice(0,7);
}

function monthDays(month){
  const [y,m] = month.split("-").map(Number);
  return new Date(y,m,0,12).getDate();
}
function previousMonth(month){
  const [y,m] = month.split("-").map(Number);
  const d = new Date(y,m-2,1,12);
  return personalMonthKey(d);
}
function validDateRange(month, now){
  const daysInMonth=monthDays(month);
  const today=personalDateKey(now);
  const maxDay = month === today.slice(0,7)
    ? Math.min(daysInMonth, Number(today.slice(-2))) : daysInMonth;
  return {start:month+"-01",end:month+"-"+String(maxDay).padStart(2,"0"),availableDays:maxDay,daysInMonth};
}
function collectPeriod({memberId,checkins,reports,month,endDay,reportsAvailable}){
  const start=month+"-01";
  const end=month+"-"+String(endDay).padStart(2,"0");
  const filtered = (checkins || []).filter(item=>{
    const date = personalDateKey(item.created_at);
    return date>=start && date<=end;
  });
  const drawDays = new Set(filtered.map(c=>personalDateKey(c.created_at)));
  const summary = memberId && reportsAvailable
    ? summarizeXp(reports || [],start,end).find(p=>String(p.id)===String(memberId)) : null;
  const dateMap = new Map();
  for(const d of drawDays){
    dateMap.set(d,{date:d,checkin:true,reflection:0,challenge:0,hasChallenge:false});
  }
  for(const day of summary?.dates || []){
    const prev=dateMap.get(day.date) || {date:day.date,checkin:false,reflection:0,challenge:0,hasChallenge:false};
    prev.checkin ||= Boolean(day.checkin);
    prev.reflection = Math.max(prev.reflection,day.reflection || 0);
    prev.challenge = Math.max(prev.challenge,day.challenge || 0);
    prev.hasChallenge ||= Boolean(day.hasChallenge);
    dateMap.set(day.date,prev);
    if(day.checkin) drawDays.add(day.date);
  }
  const imageIds = new Set();
  let imageCount = 0;
  for(const item of filtered){
    for(const image of item.checkin_images || []){
      const key=String(image.id || image.image_url || "");
      if(key && imageIds.has(key)) continue;
      if(key) imageIds.add(key);
      imageCount++;
    }
  }
  const arts = buildArtworksFromCheckins(filtered).map(art=>{
    const cover=getArtworkCover(art);
    return {id:String(art.id),url:cover?.image_url || "",date:personalDateKey(art.created_at),tags:art.tags||[]};
  }).filter(art=>art.url);
  const tagCounts = new Map();
  arts.forEach(art=>art.tags.forEach(tag=>{
    if(!tag) return;
    tagCounts.set(tag,(tagCounts.get(tag)||0)+1);
  }));
  const dates=[...drawDays].sort();
  let streak=0,maxStreak=0,previous="";
  for(const d of dates){
    const cur=new Date(d+"T12:00:00");
    const prev=previous?new Date(previous+"T12:00:00"):null;
    streak=prev && Math.round((cur-prev)/86400000)===1 ? streak+1 : 1;
    maxStreak=Math.max(maxStreak,streak);
    previous=d;
  }
  const daily=[...dateMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const reflectDays=daily.filter(x=>x.reflection>0).length;
  const deepDays=daily.filter(x=>x.reflection===20).length;
  const normalDays=daily.filter(x=>x.reflection===10).length;
  const challengeDays=daily.filter(x=>x.hasChallenge).length;
  const reflectionWithDraw=daily.filter(x=>x.reflection>0 && x.checkin).length;
  const scoreParts={
    draw:(summary?.dates || []).filter(x=>x.checkin).length*10,
    reflection:(summary?.dates || []).reduce((a,x)=>a+(x.reflection||0),0),
    challenge:(summary?.dates || []).reduce((a,x)=>a+(x.challenge||0),0)
  };
  const weeks=[];
  for(let d=1;d<=endDay;d++){
    const [y,m]=month.split("-").map(Number);
    const cur=new Date(y,m-1,d,12);
    const dayOfWeek=(cur.getDay()+6)%7;
    if(d===1 || dayOfWeek===0){
      weeks.push({label:"第"+(weeks.length+1)+"周",days:0,draw:0});
    }
    const week=weeks[weeks.length-1];
    week.days++;
    if(drawDays.has(personalDateKey(cur)))week.draw++;
  }
  return {
    month,start,end,drawDays,dates,dateMap,daily,checkins:filtered,
    drawCount:drawDays.size,maxStreak,reflectDays,normalDays,deepDays,
    challengeDays,reflectionWithDraw,
    xp:reportsAvailable&&memberId?(summary?.xp||0):null,
    scoreParts,arts,imageCount,
    topTags:[...tagCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4),
    weeks
  };
}
export function buildPersonalMonthlyData({profile,checkins=[],reports=[],month=personalMonthKey(),now=new Date(),reportsAvailable=true}){
  const monthMatch=/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  if(!monthMatch) throw new Error("统计月份格式无效");
  const dateNow=personalMonthKey(now);
  if(month>dateNow)throw new Error("不能统计未来月份");
  const range=validDateRange(month,now);
  const prevMonth=previousMonth(month);
  const prevRange=validDateRange(prevMonth,now);
  const prevEndDay=month===dateNow
    ?Math.min(range.availableDays,prevRange.daysInMonth)
    :prevRange.daysInMonth;
  const memberId=profile?.member_id || null;
  const current=collectPeriod({memberId,checkins,reports,month,endDay:range.availableDays,reportsAvailable});
  const previous=collectPeriod({memberId,checkins,reports,month:prevMonth,endDay:prevEndDay,reportsAvailable});
  const rate=range.availableDays?Math.round(current.drawCount/range.availableDays*100):0;
  const previousRate=prevEndDay?Math.round(previous.drawCount/prevEndDay*100):0;
  const difference=rate-previousRate;
  const rateSummary=difference===0?"打卡率与上期相同":
    "打卡率较上期"+(difference>0?"提高":"降低")+Math.abs(difference)+" 个百分点";
  const firstDay = new Date(month+"-01T12:00:00");
  const offset=(firstDay.getDay()+6)%7;
  const days=Array.from({length:range.daysInMonth},(_,i)=>{
    const date=month+"-"+String(i+1).padStart(2,"0");
    return {...(current.dateMap.get(date)||{
      date,checkin:false,reflection:0,challenge:0,hasChallenge:false
    }),future:i+1>range.availableDays,day:i+1};
  });
  const observations={
    rhythm:"本期 "+current.drawCount+" / "+range.availableDays+" 天留下打卡记录（"+rate+"%），"+
      "本期最长连续打卡 "+current.maxStreak+" 天；"+rateSummary+"。",
    engagement:memberId&&reportsAvailable
      ? "本期记录反思 "+current.reflectDays+" 天，其中深度反思 "+current.deepDays+
        " 天；主题挑战 "+current.challengeDays+" 次。"
      : "个人账号尚未关联周报成员，或周报暂不可读取；反思、挑战和经验值数据不完整。",
    change:"与"+prevMonth+(month===dateNow?"同期":"")+"相比，打卡率"+
      (difference>0?"提高 "+difference:difference<0?"降低 "+Math.abs(difference):"不变")+" 个百分点。"
  };
  return {
    name:profile?.username || "匿名成员",
    avatarUrl:profile?.avatar_url || "",
    id:String(profile?.id || profile?.member_id || "unknown"),
    month,periodStart:range.start,periodEnd:range.end,
    periodCaption:month===dateNow?"统计至 "+range.end:"完整自然月",
    daysInMonth:range.daysInMonth,availableDays:range.availableDays,calendarOffset:offset,
    days,rate,previousRate,difference,previousMonth:prevMonth,
    reportsLinked:Boolean(memberId&&reportsAvailable),current,previous,observations
  };
}
export function personalReportDataText(d){
  const c=d.current,p=d.previous;
  const lines=[
    "个人创作状态统计（用于撰写基于数据的评语）",
    "成员："+d.name,
    "期间："+d.periodStart+" 至 "+d.periodEnd+"（"+d.periodCaption+"）",
    "打卡："+c.drawCount+" / "+d.availableDays+" 天（"+d.rate+"%）",
    "本期最长连续打卡："+c.maxStreak+" 天",
    "上期（"+d.previousMonth+"）打卡："+p.drawCount+" / "+(d.month===personalMonthKey()?
      Math.min(d.availableDays,new Date(Number(d.previousMonth.slice(0,4)),Number(d.previousMonth.slice(5)),0).getDate()):
      new Date(Number(d.previousMonth.slice(0,4)),Number(d.previousMonth.slice(5)),0).getDate())+
      " 天（"+d.previousRate+"%）",
    "打卡率变化："+(d.difference>0?"+":"")+d.difference+" 个百分点",
    "各周打卡："+c.weeks.map(w=>w.label+" "+w.draw+"/"+w.days+" 天").join("；"),
    "上传图片："+c.imageCount+" 张",
    "本期代表性标签："+(c.topTags.map(x=>x[0]).join("、")||"暂无")
  ];
  if(d.reportsLinked){
    lines.push(
      "本期经验值："+c.xp+" XP",
      "周报打卡计分："+c.scoreParts.draw+"，反思计分："+c.scoreParts.reflection+"，挑战计分："+c.scoreParts.challenge,
      "有效反思："+c.normalDays+" 天",
      "深度反思："+c.deepDays+" 天",
      "主题挑战："+c.challengeDays+" 次",
      "同时打卡且反思："+c.reflectionWithDraw+" 天",
      "上期经验值："+p.xp+" XP"
    );
  }else{
    lines.push("周报经验值、反思、挑战：当前账号未关联周报成员，或数据暂不可读取。");
  }
  lines.push("说明：这些数据只反映打卡和活动记录，不能据此判断画技、动力或心理状态。");
  return lines.join("\n");
}
