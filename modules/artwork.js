// Artwork helpers
//
// 目标：把“打卡 checkin”和“作品 artwork”分开。
// 现在数据库里还没有 artwork_id / progress_date 等字段，
// 所以这里先做一个兼容层：
// - 有 artwork_id：按 artwork_id 合并为同一张画
// - 没有 artwork_id：用图片 id 当作临时 artwork_id，也就是旧图默认一图一作品

export function buildArtworksFromCheckins(checkins = []){
  const map = new Map();

  checkins.forEach(checkin => {
    const images = checkin.checkin_images || [];

    images.forEach((image, index) => {
      const artworkId = getArtworkId(checkin, image, index);
      const progress = buildProgressItem(checkin, image, index, artworkId);

      if(!map.has(artworkId)){
        map.set(artworkId, {
          id: artworkId,
          artwork_id: artworkId,
          user_id: image.user_id || checkin.user_id || null,
          member_id: image.member_id || checkin.member_id || null,
          username: checkin.username || "匿名",
          note: checkin.note || "",
          checkin_ids: new Set(),
          progresses: []
        });
      }

      const artwork = map.get(artworkId);

      artwork.checkin_ids.add(checkin.id);
      artwork.progresses.push(progress);

      if(!artwork.user_id && checkin.user_id){
        artwork.user_id = checkin.user_id;
      }

      if(!artwork.member_id && checkin.member_id){
        artwork.member_id = checkin.member_id;
      }

      if(!artwork.username && checkin.username){
        artwork.username = checkin.username;
      }
    });
  });

  return Array.from(map.values())
    .map(normalizeArtwork)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function buildArtworksForUser(checkins = [], profile){
  if(!profile){
    return [];
  }

  const artworks = buildArtworksFromCheckins(checkins);

  return artworks.filter(artwork => {
    if(artwork.user_id === profile.id){
      return true;
    }

    if(profile.member_id && artwork.member_id === profile.member_id){
      return true;
    }

    return false;
  });
}

export function getArtworkCover(artwork){
  return artwork?.cover || artwork?.progresses?.[0] || null;
}

export function getArtworkDate(artwork){
  const cover = getArtworkCover(artwork);
  return cover?.progress_date || artwork?.created_at || "";
}

function getArtworkId(checkin, image, index){
  return (
    image.artwork_id ||
    image.id ||
    `${checkin.id || "checkin"}_${index}`
  );
}

function buildProgressItem(checkin, image, index, artworkId){
  return {
    id: image.id,
    image_id: image.id,
    artwork_id: artworkId,
    checkin_id: checkin.id,
    user_id: image.user_id || checkin.user_id || null,
    member_id: image.member_id || checkin.member_id || null,
    username: checkin.username || "匿名",
    image_url: image.image_url,
    storage_path: image.storage_path,
    tags: image.tags || [],
    note: checkin.note || "",
    progress_label: image.progress_label || "作品",
    progress_order: Number.isFinite(Number(image.progress_order))
      ? Number(image.progress_order)
      : index,
    progress_date: image.progress_date || checkin.created_at,
    checkin_created_at: checkin.created_at
  };
}

function normalizeArtwork(artwork){
  const progresses = artwork.progresses
    .slice()
    .sort(compareProgress);

  const cover = progresses[progresses.length - 1] || null;

  return {
    ...artwork,
    checkin_ids: Array.from(artwork.checkin_ids),
    checkin_count: artwork.checkin_ids.size,
    progresses,
    cover,
    image_url: cover?.image_url || "",
    tags: cover?.tags || [],
    created_at: cover?.progress_date || cover?.checkin_created_at || ""
  };
}

function compareProgress(a, b){
  const timeA = new Date(a.progress_date || a.checkin_created_at || 0).getTime();
  const timeB = new Date(b.progress_date || b.checkin_created_at || 0).getTime();

  if(timeA !== timeB){
    return timeA - timeB;
  }

  return (a.progress_order || 0) - (b.progress_order || 0);
}
