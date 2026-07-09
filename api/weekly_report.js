import { uploadImage } from "./storage.js";

export function normalizeName(name){
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export async function loadMembers(sb){
  const { data, error } = await sb
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });

  if(error){
    console.error("loadMembers error:", error);
    return [];
  }

  return data || [];
}

export async function findOrCreateMember(sb, displayName){
  const name = String(displayName || "").trim();

  if(!name){
    return null;
  }

  const normalizedName = normalizeName(name);

  const { data: existing, error: findErr } = await sb
    .from("members")
    .select("*")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if(findErr){
    console.error("find member error:", findErr);
    return null;
  }

  if(existing){
    return existing;
  }

  const { data: created, error: createErr } = await sb
    .from("members")
    .insert({
      display_name: name,
      normalized_name: normalizedName
    })
    .select()
    .single();

  if(createErr){
    console.error("create member error:", createErr);
    return null;
  }

  return created;
}

export async function loadWeeklyReports(sb){
  const { data, error } = await sb
    .from("weekly_reports")
    .select(`
      *,
      weekly_report_items(*)
    `)
    .order("start_date", { ascending: false });

  if(error){
    console.error("loadWeeklyReports error:", error);
    return [];
  }

  return data || [];
}

export async function createWeeklyReport(sb, report){
  const { data, error } = await sb
    .from("weekly_reports")
    .insert({
      title: report.title || "本周创作报告",
      start_date: report.start_date,
      end_date: report.end_date,
      theme_color: report.theme_color || "#ff6a16",
      event_notes: report.event_notes || "",
      contributors: report.contributors || ""
    })
    .select()
    .single();

  if(error){
    console.error("createWeeklyReport error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function updateWeeklyReport(sb, reportId, patch){
  const { data, error } = await sb
    .from("weekly_reports")
    .update({
      title: patch.title,
      start_date: patch.start_date,
      end_date: patch.end_date,
      theme_color: patch.theme_color,
      event_notes: patch.event_notes,
      contributors: patch.contributors
    })
    .eq("id", reportId)
    .select()
    .single();

  if(error){
    console.error("updateWeeklyReport error:", error);
    return { data: null, error };
  }

  return { data, error: null };
}

export async function deleteWeeklyReport(sb, reportId){
  const { error } = await sb
    .from("weekly_reports")
    .delete()
    .eq("id", reportId);

  if(error){
    console.error("deleteWeeklyReport error:", error);
    return false;
  }

  return true;
}

export async function uploadWeeklyCover(sb, file){
  if(!file) return "";

  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = "weekly/" + Date.now() + "_" + safeName;

  return await uploadImage(sb, file, path);
}

export async function saveWeeklyReportItems(sb, reportId, items){
  const oldItems = await loadWeeklyReportItems(sb, reportId);

  await deleteProxyCheckinsForReport(sb, reportId);
  await deleteWeeklyReportItems(sb, reportId);

  const savedItems = [];

  for(let i = 0; i < items.length; i++){
    const item = items[i];
    const member = await findOrCreateMember(sb, item.display_name);

    if(!member){
      continue;
    }

    const checkinDates = normalizeDates(item.checkin_dates);

    const { data: savedItem, error } = await sb
      .from("weekly_report_items")
      .insert({
        report_id: reportId,
        member_id: member.id,
        display_name: member.display_name,
        cover_image_url: item.cover_image_url || "",
        cover_storage_path: item.cover_storage_path || "",
        checkin_dates: checkinDates,
        summary: item.summary || "",
        nickname_title: item.nickname_title || "",
        sort_order: i
      })
      .select()
      .single();

    if(error){
      console.error("save weekly item error:", error);
      continue;
    }

    savedItems.push(savedItem);

    await createProxyCheckinsForItem(sb, {
      reportId,
      itemId: savedItem.id,
      memberId: member.id,
      dates: checkinDates,
      summary: item.summary || ""
    });
  }

  return savedItems;
}

async function loadWeeklyReportItems(sb, reportId){
  const { data, error } = await sb
    .from("weekly_report_items")
    .select("*")
    .eq("report_id", reportId);

  if(error){
    console.error("load weekly items error:", error);
    return [];
  }

  return data || [];
}

async function deleteWeeklyReportItems(sb, reportId){
  const { error } = await sb
    .from("weekly_report_items")
    .delete()
    .eq("report_id", reportId);

  if(error){
    console.error("delete weekly items error:", error);
  }
}

async function deleteProxyCheckinsForReport(sb, reportId){
  const { error } = await sb
    .from("checkins")
    .delete()
    .eq("source", "weekly_report")
    .eq("weekly_report_id", reportId)
    .is("claimed_at", null);

  if(error){
    console.error("delete proxy checkins error:", error);
  }
}

async function createProxyCheckinsForItem(sb, options){
  for(const date of options.dates){
    const exists = await hasProxyCheckinOnDate(sb, options.memberId, date);

    if(exists){
      continue;
    }

    const { error } = await sb
      .from("checkins")
      .insert({
        user_id: null,
        member_id: options.memberId,
        source: "weekly_report",
        weekly_report_id: options.reportId,
        weekly_report_item_id: options.itemId,
        proxy_note: options.summary || "周报代录打卡",
        created_at: date + "T12:00:00"
      });

    if(error){
      console.error("create proxy checkin error:", error);
    }
  }
}

async function hasProxyCheckinOnDate(sb, memberId, date){
  const start = date + "T00:00:00";
  const end = date + "T23:59:59";

  const { data, error } = await sb
    .from("checkins")
    .select("id")
    .eq("member_id", memberId)
    .gte("created_at", start)
    .lte("created_at", end)
    .limit(1);

  if(error){
    console.error("check proxy exists error:", error);
    return true;
  }

  return (data || []).length > 0;
}

function normalizeDates(dates){
  if(!Array.isArray(dates)) return [];

  return dates
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .sort();
}

// 周报系统 API

export async function createWeeklyReport(sb, data){

  const { data: report, error } = await sb
    .from("weekly_reports")
    .insert({
      title: data.title,
      start_date: data.start_date,
      end_date: data.end_date,
      theme_color: data.theme_color || "#ff6a16",
      summary: data.summary || ""
    })
    .select()
    .single();

  if(error){
    console.error("createWeeklyReport:", error);
    return { data:null, error };
  }

  return {
    data: report,
    error:null
  };
}



export async function loadWeeklyReports(sb){

  const { data, error } = await sb
    .from("weekly_reports")
    .select(`
      *,
      weekly_report_items(
        *,
        profiles(
          username,
          avatar_url
        )
      )
    `)
    .order("created_at", {
      ascending:false
    });


  if(error){
    console.error("loadWeeklyReports:", error);
    return [];
  }

  return data || [];
}



export async function addWeeklyReportItem(sb, data){

  const { data:item, error } = await sb
    .from("weekly_report_items")
    .insert({

      report_id:data.report_id,

      member_id:data.member_id,

      checkin_dates:data.checkin_dates || [],

      badge_data:data.badge_data || {},

      representative_image:
        data.representative_image || null,

      summary:
        data.summary || ""

    })
    .select()
    .single();


  if(error){
    console.error("addWeeklyReportItem:", error);
    return null;
  }


  return item;
}



export async function deleteWeeklyReport(sb, reportId){

  const { error } = await sb
    .from("weekly_reports")
    .delete()
    .eq("id", reportId);


  if(error){
    console.error("deleteWeeklyReport:", error);
    return false;
  }


  return true;
}
