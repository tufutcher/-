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
      contributors: report.contributors || "",

      poster_columns: report.poster_columns || 9,
      poster_name_font: report.poster_name_font || 28,
      poster_card_font: report.poster_card_font || 16,
      poster_event_font: report.poster_event_font || 10
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
  const payload = {};

  [
    "title",
    "start_date",
    "end_date",
    "theme_color",
    "event_notes",
    "contributors",
    "poster_columns",
    "poster_name_font",
    "poster_card_font",
    "poster_event_font"
  ].forEach(key => {
    if(patch[key] !== undefined){
      payload[key] = patch[key];
    }
  });

  const { data, error } = await sb
    .from("weekly_reports")
    .update(payload)
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
  await deleteProxyCheckinsForReport(sb, reportId);
  await deleteWeeklyReportItems(sb, reportId);

  const savedItems = [];
  let proxyErrorCount = 0;

  for(let i = 0; i < items.length; i++){
    const item = items[i];
    const member = await findOrCreateMember(sb, item.display_name);

    if(!member){
      proxyErrorCount++;
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
      proxyErrorCount++;
      continue;
    }

    savedItems.push(savedItem);

    const proxyResult = await createProxyCheckinsForItem(sb, {
      reportId,
      itemId: savedItem.id,
      memberId: member.id,
      displayName: member.display_name,
      dates: checkinDates,
      summary: item.summary || ""
    });

    proxyErrorCount += proxyResult.errorCount;
  }

  if(proxyErrorCount > 0){
    console.error("weekly proxy checkin failed count:", proxyErrorCount);
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
  let successCount = 0;
  let errorCount = 0;

  for(const date of options.dates){
    const exists = await hasCheckinOnDate(
      sb,
      options.memberId,
      date
    );

    if(exists){
      continue;
    }

    const note =
      options.summary || "周报代录打卡";

    const { error } = await sb
      .from("checkins")
      .insert({
        user_id: null,
        username: options.displayName,
        note: note,
        member_id: options.memberId,
        source: "weekly_report",
        weekly_report_id: options.reportId,
        weekly_report_item_id: options.itemId,
        proxy_note: note,
        created_at: date + "T12:00:00"
      });

    if(error){
      console.error("create proxy checkin error:", error);
      errorCount++;
    }else{
      successCount++;
    }
  }

  return {
    successCount,
    errorCount
  };
}

async function hasCheckinOnDate(sb, memberId, date){
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
    console.error("check existing checkin error:", error);
    return true;
  }

  return (data || []).length > 0;
}

export async function claimWeeklyProxyCheckin(sb, checkinId, userId){
  const { data: checkin, error: checkinError } = await sb
    .from("checkins")
    .select("*")
    .eq("id", checkinId)
    .single();

  if(checkinError || !checkin){
    console.error("claim proxy checkin find error:", checkinError);
    return false;
  }

  if(checkin.source !== "weekly_report"){
    return false;
  }

  if(checkin.user_id){
    return false;
  }

  const { data: profile, error: profileError } = await sb
    .from("profiles")
    .select("member_id, username")
    .eq("id", userId)
    .single();

  if(profileError || !profile?.member_id){
    console.error("claim proxy profile error:", profileError);
    return false;
  }

  if(profile.member_id !== checkin.member_id){
    console.error("this proxy checkin does not belong to this member");
    return false;
  }

  const { error } = await sb
    .from("checkins")
    .update({
      user_id: userId,
      username: profile.username || checkin.username,
      source: "manual",
      claimed_at: new Date().toISOString()
    })
    .eq("id", checkinId);

  if(error){
    console.error("claim proxy checkin update error:", error);
    return false;
  }

  return true;
}

function normalizeDates(dates){
  if(!Array.isArray(dates)) return [];

  return dates
    .map(x => String(x || "").trim())
    .filter(Boolean)
    .sort();
}
