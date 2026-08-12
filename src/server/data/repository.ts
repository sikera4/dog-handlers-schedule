import "server-only";

import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { DevelopmentRepository } from "@/server/data/development-repository";
import {
  SupabaseAdminRepository,
  SupabasePublicRepository,
} from "@/server/data/supabase-repository";
import type { AdminRepository, BookingRepository } from "@/server/data/types";
import { createPublicSupabaseClient } from "@/server/supabase/server";

const globalRepositories = globalThis as unknown as {
  developmentRepository?: DevelopmentRepository;
};

function getDevelopmentRepository() {
  if (!globalRepositories.developmentRepository) {
    globalRepositories.developmentRepository = new DevelopmentRepository(
      path.resolve(process.cwd(), env.DEV_DATA_FILE),
    );
  }
  return globalRepositories.developmentRepository;
}

export function getPublicRepository(): BookingRepository {
  if (env.DATA_BACKEND === "supabase") {
    return new SupabasePublicRepository(createPublicSupabaseClient());
  }
  return getDevelopmentRepository();
}

export function getAdminRepository(client?: SupabaseClient): AdminRepository {
  if (env.DATA_BACKEND === "supabase") {
    if (!client) throw new Error("Authenticated Supabase client is required");
    return new SupabaseAdminRepository(client);
  }
  return getDevelopmentRepository();
}
