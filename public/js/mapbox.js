export const displayMap = (locations) => {
    mapboxgl.accessToken = 'pk.eyJ1IjoibmFtbmcxOTEiLCJhIjoiY2thMW4yaXc3MDBjeDNlbWRkYWt2MW4zMSJ9.wrSLzgMVY0R5q16EdfJDhw';

    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/namng191/cka1n5oxy1in81imgvy2e6ryv',
        scrollZoom: false,
        zoom: 10
    });

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach(loc => {
        // Create a marker
        const el =  document.createElement('div');
        el.className = 'marker';
        // Add marker to map
        new mapboxgl.Marker({
            element: el,
            anchor: 'bottom'
        }).setLngLat(loc.coordinates).addTo(map);
        // Add Pop Up
        new mapboxgl.Popup({ offset: 30 })
                    .setLngLat(loc.coordinates)
                    .setHTML(`<p>Day ${ loc.day }: ${ loc.description }</p>`)
                    .addTo(map);
        // Extend map bound to include new marker
        bounds.extend(loc.coordinates);
    });

    map.fitBounds(bounds, {
        padding: {
            top: 200,
            bottom: 150,
            left: 100,
            right: 100
        }
    });
}