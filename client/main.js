const SearchComponent = {
    data() {
      return {
        city: ''
      };
    },
    methods: {
      async updateCity() {
        try {
          const response = await axios.get(`http://127.0.0.1:5000/weather/${this.city}`);
          console.log('Weather Data:', response.data);
        } catch (error) {
          console.error('An error occurred while fetching data:', error);
        }
      }
    },
    template: `
      <div>
        <input type="text" v-model="city" @input="updateCity" placeholder="Enter city">
      </div>
    `
  };

new Vue({
    el: '#app',
    components: {
        SearchComponent
    },
    mounted() {
        console.log("Vue app mounted!");
    }
})