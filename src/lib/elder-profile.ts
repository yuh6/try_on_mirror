/**
 * 老人档案的纯类型与常量（无服务端依赖，客户端可安全引入）。
 */

/** elder_profile.json 的完整档案结构 */
export interface ElderProfile {
  name: string;
  age: string;
  gender: string;
  title: string;
  living: string;
  marriage: string;
  spouse: string;
  living_status: string;
  health_items: { name: string; medicine: string; notes: string }[];
  family: {
    name: string;
    relation: string;
    age: string;
    job: string;
    location: string;
    phone: string;
    note: string;
  }[];
  routine: string;
  activities: string;
  hobbies: string;
  contact_habit: string;
  personality: string;
  speech_habits: string;
  call_ai: string;
  emotion_style: string;
}

export const EMPTY_ELDER_PROFILE: ElderProfile = {
  name: "",
  age: "",
  gender: "",
  title: "",
  living: "",
  marriage: "",
  spouse: "",
  living_status: "",
  health_items: [],
  family: [],
  routine: "",
  activities: "",
  hobbies: "",
  contact_habit: "",
  personality: "",
  speech_habits: "",
  call_ai: "",
  emotion_style: "",
};

/** 语音收集过程中已收集的字段（客户端持有、每次随请求带上） */
export interface CollectedProfile {
  relation?: string;
  title?: string;
  age?: string;
  gender?: string;
  living?: string;
  health?: string;
  family?: FamilyMember[];
  hobbies?: string;
  personality?: string;
}

export interface FamilyMember {
  name?: string;
  relation?: string;
  phone?: string;
  job?: string;
  location?: string;
}

/** 一轮对话条目（客户端展示 + 服务端重建对话上下文） */
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}
