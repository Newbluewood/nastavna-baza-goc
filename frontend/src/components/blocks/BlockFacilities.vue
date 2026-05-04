<script setup>
import { useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'

const props = defineProps({
  facilities: Array
})

const emit = defineEmits(['open'])
const router = useRouter()
const langStore = useLangStore()

const viewRooms = (facility) => {
  router.push(`/smestaj/${facility.id}`)
}
</script>

<template>
  <div class="original-facilities-wrapper">
    <!-- Naslov sekcije je opcionalan ovde jer ga PageTemplate daje, ali ga ostavljamo radi konzistentnosti -->
    <h2 class="section-title-classic">
      {{ langStore.currentLang === 'sr' ? 'Објекти' : 'Facilities' }}
    </h2>

    <div class="facilities-grid">
      <div v-for="(facility, idx) in facilities" :key="facility.id" class="facility-card">
        <div class="image-wrapper" @click="$emit('open', idx)">
          <img :src="facility.cover_image || '/placeholder.jpg'" class="facility-img" />
          <div class="overlay-text">
            <span>📷 {{ langStore.currentLang === 'sr' ? 'Погледај галерију' : 'View Gallery' }}</span>
          </div>
        </div>

        <div class="info-pane">
          <h3>{{ facility.name }}</h3>
          
          <div class="badges-row" v-if="facility.location_badges?.length">
            <span class="badge" v-for="badge in facility.location_badges" :key="badge">🌲 {{ badge }}</span>
          </div>

          <p class="capacity-text">
            <strong>{{ langStore.currentLang === 'sr' ? 'Капацитет' : 'Capacity' }}:</strong> {{ facility.capacity || 'N/A' }}
          </p>

          <div v-if="facility.min_price" class="price-box-classic">
             <span class="price-from">{{ langStore.currentLang === 'sr' ? 'Цене од' : 'Prices from' }}</span>
             <span class="price-amount">{{ facility.min_price }} RSD</span>
          </div>

          <div class="desc-classic" v-html="facility.description"></div>

          <div class="actions-pane">
            <button @click="viewRooms(facility)" class="btn-classic">
              {{ langStore.currentLang === 'sr' ? 'Погледај Собе' : 'View Rooms' }}
            </button>

            <a v-if="facility.latitude && facility.longitude" 
               :href="'https://www.google.com/maps/search/?api=1&query=' + facility.latitude + ',' + facility.longitude" 
               target="_blank" 
               class="map-link-classic">
              {{ langStore.currentLang === 'sr' ? 'Мапа' : 'Map' }}
            </a>
          </div>
        </div>

        <div v-if="facility.floor_plan_image" class="plan-pane">
           <h4>{{ langStore.currentLang === 'sr' ? 'План' : 'Plan' }}</h4>
           <img :src="facility.floor_plan_image" alt="Plan" @click="$emit('open', idx)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.original-facilities-wrapper { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.section-title-classic { margin-bottom: 30px; border-left: 4px solid #332317; padding-left: 10px; font-size: 1.5rem; color: #332317; }

.facilities-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 30px; }

.facility-card {
  display: flex; flex-direction: column; background: #fff;
  border: 1px solid #e8ddd2; border-radius: 0; overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.image-wrapper { position: relative; cursor: pointer; height: 250px; overflow: hidden; }
.facility-img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s; }
.image-wrapper:hover .facility-img { transform: scale(1.05); }

.overlay-text {
  position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.6);
  color: #fff; padding: 10px; text-align: center; opacity: 0; transition: opacity 0.3s;
}
.image-wrapper:hover .overlay-text { opacity: 1; }

.info-pane { padding: 25px; display: flex; flex-direction: column; flex: 1; }
.info-pane h3 { margin-top: 0; font-size: 1.5rem; color: #332317; margin-bottom: 10px; }

.badges-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 15px; }
.badge { background: #f1f1f1; color: #495057; padding: 4px 8px; font-size: 0.8rem; font-weight: 500; }

.capacity-text { font-size: 0.95rem; color: #555; margin-bottom: 15px; }

.price-box-classic {
  display: flex; flex-direction: column; background: #fdfaf7;
  border-left: 4px solid #332317; padding: 10px 15px; margin-bottom: 20px; width: fit-content;
}
.price-from { font-size: 0.75rem; color: #888; text-transform: uppercase; }
.price-amount { font-size: 1.25rem; font-weight: 800; color: #332317; }

.desc-classic { flex: 1; font-size: 0.95rem; line-height: 1.6; margin-bottom: 20px; color: #67462e; }

.actions-pane { display: flex; gap: 15px; margin-top: auto; align-items: center; }
.btn-classic {
  background: #332317; color: #fff; border: none; padding: 12px 20px;
  font-size: 1rem; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: background 0.3s;
}
.btn-classic:hover { background: #4a3425; }
.map-link-classic { text-decoration: none; font-size: 0.95rem; font-weight: bold; color: #332317; }

.plan-pane { border-top: 1px solid #e8ddd2; padding: 20px; background: #f9f9f9; }
.plan-pane h4 { margin-top: 0; color: #555; margin-bottom: 10px; }
.plan-pane img { max-width: 100%; max-height: 200px; object-fit: contain; cursor: pointer; border: 1px solid #e8ddd2; }

@media (max-width: 768px) { 
  .facilities-grid { 
    grid-template-columns: 1fr; 
    gap: 20px;
    justify-items: center;
  }
  .facility-card {
    width: 100%;
    max-width: 500px; /* Limitiramo širinu da ne bi bila preogromna na većim telefonima */
    margin: 0 auto;
  }
}
</style>
