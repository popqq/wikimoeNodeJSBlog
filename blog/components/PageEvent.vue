<template>
  <div>
    <div class="page-event-body">
      <DivLoading :loading="eventLoading" />
      <div class="page-event-month-year">
        <div>
          <!-- UButton icon heroicon -->
          <UButton
            icon="i-heroicons-chevron-double-left"
            size="2xs"
            color="primary"
            variant="ghost"
            @click="lastYear"
            :disabled="!showLastYear"
          ></UButton>
          <UButton
            icon="i-heroicons-chevron-left"
            size="2xs"
            color="primary"
            variant="ghost"
            @click="lastMonth"
            :disabled="!showLastMonth"
          ></UButton>
        </div>
        {{ monthYear }}
        <div>
          <UButton
            icon="i-heroicons-chevron-right"
            size="2xs"
            color="primary"
            variant="ghost"
            @click="nextMonth"
            :disabled="!showNextMonth"
          ></UButton>
          <UButton
            icon="i-heroicons-chevron-double-right"
            size="2xs"
            color="primary"
            variant="ghost"
            @click="nextYear"
            :disabled="!showNextYear"
          ></UButton>
        </div>
      </div>
      <div class="page-event-table-body custom-scroll scroll-not-hide">
        <Calendar
          :events="eventList"
          :startTime="startTime"
          v-show="eventList.length > 0"
          @eventClick="tryOpenEvent"
          @dayClick="dayClick"
        />
        <div
          class="page-event-table-empty text-primary-500"
          v-show="eventList.length === 0"
        >
          <div v-show="!eventLoading">该月无事发生</div>
        </div>
      </div>
    </div>
    <EventDialog v-model:show="eventOpen" :currentData="currentData" />
    <CommonDialog v-model:show="dayEventListOpen">
      <template #title>
        <h3
          class="text-base font-semibold leading-6 text-gray-900 dark:text-white"
        >
          {{ dayEventTitle }}
        </h3>
      </template>
      <template #body>
        <div v-if="dayEventList.length > 0">
          <div
            v-for="item in dayEventList"
            :key="item._id"
            class="pb-1 mb-3 border border-solid border-gray-200 py-2 px-3 rounded-md"
          >
            <div class="page-event-current-content">
              <h4
                class="text-base font-semibold leading-6 text-gray-900 dark:text-white mb-1"
              >
                <span
                  class="page-event-block"
                  :style="{
                    backgroundColor: item.eventtype?.color,
                  }"
                  v-if="item.eventtype"
                  >{{ item.eventtype?.name }}</span
                >{{ item.title }}
              </h4>
              <div class="flex items-center mb-1">
                <div class="flex items-center">
                  <UIcon name="i-heroicons-clock" />
                </div>
                <div class="text-gray-700 text-xs ml-2">
                  {{ formatDate(item.startTime) }} ~
                  {{ formatDate(item.endTime) }}
                </div>
              </div>
              <div class="event-list-html-content-body">
                <HtmlContent :content="item.content" v-if="item.content" />
              </div>

              <!-- 相关链接 urlList -->
              <div
                class="text-sm mb-2 mt-2 text-gray-500 flex-shrink-0"
                v-if="item.urlList.length > 0"
              >
                <a
                  :href="url.url"
                  target="_blank"
                  class="inline-flex items-center text-primary-500 mr-2"
                  v-for="(url, index) in item.urlList"
                  :key="index"
                >
                  <UIcon name="i-heroicons-link" class="align-middle mr-1" />
                  {{ url.text }}
                </a>
              </div>
            </div>
          </div>
        </div>
        <div v-else>
          <div class="tc text-gray-500 py-5">当日无事发生</div>
        </div>
      </template>
    </CommonDialog>
  </div>
</template>
<script setup>
import { getEventListApiFetch, getEventDetailApiFetch } from '@/api/event'
import moment from 'moment'

const router = useRouter()
const route = useRoute()

const toast = useToast()

const eventList = ref([])
const startTime = ref(null)
const endTime = ref(null)
// 月
const monthYear = computed(() => {
  const start = new Date(startTime.value)
  // const end = new Date(endTime.value)
  return `${start.getFullYear()}年${start.getMonth() + 1}月`
})
const eventLoading = ref(false)
const getList = async (hash) => {
  eventLoading.value = true
  eventList.value = []
  const res = await getEventListApiFetch({
    startTime: new Date(startTime.value).toISOString(),
    endTime: new Date(endTime.value).toISOString(),
  })
    .then((res) => {
      // 获取startTime.value的年和月
      const year = startTime.value.getFullYear()
      const month = startTime.value.getMonth() + 1
      // 设置
      changeRouter({ year, month }, hash)
      return res
    })
    .catch((err) => {
      console.log(err)
    })
  eventList.value = res?.list || []
  eventLoading.value = false
}

// 开始时间和结束时间的范围在1980年1月1日到本地时间的20年之后
// 20年之后的时间
const maxDate = new Date(new Date().getFullYear() + 20, 11, 31)
// 1980年1月1日
const minDate = new Date(1980, 0, 1)
// 初始化时间
const initTime = () => {
  // 从query中获取年和月
  const query = route.query
  const year = parseInt(query.year)
  const month = parseInt(query.month) - 1

  if (year && month >= 0 && month <= 11) {
    const proposedStartDate = new Date(year, month, 1)
    const proposedEndDate = new Date(year, month + 1, 0)
    proposedEndDate.setHours(23, 59, 59)

    if (proposedStartDate >= minDate && proposedEndDate <= maxDate) {
      startTime.value = proposedStartDate
      endTime.value = proposedEndDate
      return
    }
  }

  const now = new Date()
  // 获取当前系统的月的第一天和最后一天
  startTime.value = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  endDate.setHours(23, 59, 59)
  endTime.value = endDate
}
// 是否显示上一年
const showLastYear = computed(() => {
  const date = new Date(startTime.value)
  return date.getFullYear() > 1980
})
// 是否显示下一年
const showNextYear = computed(() => {
  const date = new Date(startTime.value)
  return date.getFullYear() < maxDate.getFullYear()
})
// 是否显示上个月
const showLastMonth = computed(() => {
  const date = new Date(startTime.value)
  date.setMonth(date.getMonth() - 1)
  return date >= minDate
})
// 是否显示下个月
const showNextMonth = computed(() => {
  const date = new Date(startTime.value)
  date.setMonth(date.getMonth() + 1)
  return date <= maxDate
})
// 去年
const lastYear = () => {
  const date = new Date(startTime.value)
  date.setFullYear(date.getFullYear() - 1)
  startTime.value = new Date(date.getFullYear(), date.getMonth(), 1)
  let endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  endDate.setHours(23, 59, 59)
  endTime.value = endDate
  getList()
}
// 下一年
const nextYear = () => {
  const date = new Date(startTime.value)
  date.setFullYear(date.getFullYear() + 1)
  startTime.value = new Date(date.getFullYear(), date.getMonth(), 1)
  let endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  endDate.setHours(23, 59, 59)
  endTime.value = endDate
  getList()
}
// 上个月
const lastMonth = () => {
  const date = new Date(startTime.value)
  date.setMonth(date.getMonth() - 1)
  startTime.value = new Date(date.getFullYear(), date.getMonth(), 1)
  let endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  endDate.setHours(23, 59, 59)
  endTime.value = endDate
  getList()
}
// 下个月
const nextMonth = () => {
  const date = new Date(startTime.value)
  date.setMonth(date.getMonth() + 1)
  startTime.value = new Date(date.getFullYear(), date.getMonth(), 1)
  let endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  endDate.setHours(23, 59, 59)
  endTime.value = endDate
  getList()
}

const eventOpen = ref(false)
const currentData = ref(null)
const tryOpenEvent = (data) => {
  currentData.value = data
  eventOpen.value = true
  // 路由添加eventid
  changeRouter({ eventid: data._id })
}

const getEventDetail = async () => {
  eventLoading.value = true
  const id = route.query.eventid
  getEventDetailApiFetch({
    id,
  })
    .then((res) => {
      currentData.value = res.data
      eventOpen.value = true
    })
    .catch((err) => {
      console.log(err)
      const errors = err.response?._data?.errors
      if (errors) {
        errors.forEach((item) => {
          const message = item.message
          toast.add({
            title: message,
            icon: 'i-heroicons-x-circle',
            color: 'red',
          })
        })
      }
      if (route.query.eventid) {
        removeRouterQuery('eventid')
      }
    })
    .finally(() => {
      eventLoading.value = false
    })
}

// watch route
watch(
  () => route.query,
  (newVal, oldVal) => {
    if (newVal.eventid) {
      const data = eventList.value.find((item) => item._id === newVal.eventid)
      if (data) {
        currentData.value = data
        eventOpen.value = true
      } else {
        getEventDetail()
      }
    } else {
      eventOpen.value = false
    }
  }
)

watch(
  () => eventOpen.value,
  (newVal) => {
    if (!newVal && route.query.eventid) {
      removeRouterQuery('eventid')
    }
  }
)

const dayEventListOpen = ref(false)
const dayEventList = ref([])
const dayEventTitle = ref('')
const setDayEventTitle = (YYYYMMDD) => {
  const date = moment(YYYYMMDD, 'YYYY-MM-DD')
  dayEventTitle.value = `${date.format('YYYY年M月D日')}活动`
}
const dayClick = (day, dayEventIdMap) => {
  const idList = dayEventIdMap[day.monthDay] || []
  dayEventList.value = eventList.value.filter((item) =>
    idList.includes(item._id)
  )
  setDayEventTitle(day.monthDay)
  dayEventListOpen.value = true
  changeRouter({ daydetail: day.monthDay })
}

watch(
  () => dayEventListOpen.value,
  (newVal) => {
    if (!newVal) {
      const query = route.query
      if (query.daydetail) {
        removeRouterQuery('daydetail')
      }
    }
  }
)

const getEventListByDay = (dateYYYYMMDD) => {
  const momentDate = moment(dateYYYYMMDD, 'YYYY-MM-DD')
  // 将eventList中开始和结束时间转换成YYYY-MM-DD
  dayEventList.value = eventList.value.filter((item) => {
    const startTime = moment(item.startTime).format('YYYY-MM-DD')
    const endTime = moment(item.endTime).format('YYYY-MM-DD')
    return (
      momentDate.isSameOrAfter(startTime) && momentDate.isSameOrBefore(endTime)
    )
  })
  setDayEventTitle(dateYYYYMMDD)
  dayEventListOpen.value = true
}

const changeRouter = (newQuery, hash) => {
  const query = route.query
  router.replace({
    query: {
      eventid: newQuery.eventid || query.eventid || undefined,
      year: newQuery.year || query.year || undefined,
      month: newQuery.month || query.month || undefined,
      daydetail: newQuery.daydetail || query.daydetail || undefined,
    },
    hash: hash || undefined,
  })
}

const removeRouterQuery = (key) => {
  const query = JSON.parse(JSON.stringify(route.query))
  delete query[key]
  router.replace({ query })
}

onMounted(() => {
  nextTick(async () => {
    initTime()
    await getList(route.hash)
    nextTick(() => {
      if (route.query.eventid) {
        getEventDetail()
      }
      if (route.query.daydetail) {
        const daydetail = route.query.daydetail
        // 检查daydetail格式是否正确
        if (moment(daydetail, 'YYYY-MM-DD', true).isValid()) {
          getEventListByDay(daydetail)
        } else {
          removeRouterQuery('daydetail')
        }
      }
    })
  })
})
onUnmounted(() => {})
</script>
<style scoped>
.page-event-table {
  width: max-content;
}
.page-event-table-td {
  width: 25px;
  text-align: center;
  vertical-align: middle;
  font-size: 12px;
}
/* .page-event-table-td.event {
  background-color: #ffffff;
} */
.page-event-table-td.event .page-event-table-td-title {
  /* 竖排显示文字 */
  writing-mode: vertical-rl;
  color: #ffffff;
  border-radius: 25px;
  overflow: hidden;
  white-space: nowrap;
  width: 23px;
  margin: 0 1px;
  box-sizing: border-box;
  padding: 5px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}
.page-event-table-td.event .page-event-table-td-title.no-start {
  /* 左上角，右上角不要圆角 */
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.page-event-table-td.event .page-event-table-td-title.no-end {
  /* 左下角，右下角不要圆角 */
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.page-event-body {
  @apply border border-primary-200 border-solid;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}
.page-event-table-body {
  overflow: hidden;
}

.page-event-month-year {
  @apply text-center;
  padding: 10px 5px;
  display: flex;
  justify-content: space-between;
  font-size: 16px;
}
.page-event-table-empty {
  height: 500px;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
<style>
.page-event-current-content p {
  margin: 10px 0;
}
.event-list-html-content-body .html-content-body {
  padding-top: 0px;
}
</style>
