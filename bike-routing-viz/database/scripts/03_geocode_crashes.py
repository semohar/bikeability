#!/usr/bin/env python3
"""
Geocode crash data using ESRI ArcGIS API
"""
import os
import sys
import requests
import pandas as pd
from time import sleep
import re

# Configuration
ESRI_API_KEY = os.environ.get('ESRI_API_KEY', '')
INPUT_FILE = '../data/crash_data.csv'
OUTPUT_FILE = '../data/crash_data_geocoded.csv'
ESRI_GEOCODE_URL = 'https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates'

def parse_location_components(on_street, at_street):
    """Parse location strings and extract components"""
    on_street = str(on_street) if pd.notna(on_street) else ''
    at_street = str(at_street) if pd.notna(at_street) else ''
    
    result = {
        'location_type': None,
        'street1': None,
        'street2': None,
        'direction': None,
        'block_number': None,
        'address': None
    }
    
    on_clean = on_street.strip()
    direction_match = re.match(r'^(NORTH OF|SOUTH OF|EAST OF|WEST OF)\s+(.+)', on_clean, re.IGNORECASE)
    if direction_match:
        result['direction'] = direction_match.group(1)
        on_clean = direction_match.group(2)
    
    blk_match = re.match(r'^BLK\s+(\d+)\s+(.+)', on_clean, re.IGNORECASE)
    if blk_match:
        result['block_number'] = blk_match.group(1)
        result['street1'] = blk_match.group(2).replace('CST ', '').replace('PP ', '').strip()
        result['location_type'] = 'block'
    else:
        on_clean = on_clean.replace('CST ', '').replace('PP ', '').replace('ALY ', '').strip()
        result['street1'] = on_clean
    
    at_clean = at_street.strip()
    if at_clean.upper().startswith('BTWN'):
        result['location_type'] = 'between'
        between_str = at_clean.replace('BTWN ', '').replace('CST ', '').replace('PP ', '')
        if ' AND ' in between_str.upper():
            parts = re.split(r'\s+AND\s+', between_str, flags=re.IGNORECASE)
            result['street2'] = parts[0].strip() if len(parts) > 0 else None
    elif re.match(r'^\d+', at_clean):
        result['location_type'] = 'address'
        address_clean = re.sub(r'(PARKING LOT AT|AT)\s*', '', at_clean, flags=re.IGNORECASE).strip()
        result['address'] = address_clean
    elif at_clean and at_clean.upper() not in ['ALLEY', '']:
        at_clean = at_clean.replace('CST ', '').replace('PP ', '').replace('ALY ', '').strip()
        if at_clean.upper() != 'ALLEY':
            result['street2'] = at_clean
            if not result['location_type']:
                result['location_type'] = 'intersection'
    
    return result

def build_esri_query(components):
    """Build ESRI geocode query from parsed components"""
    loc_type = components['location_type']
    
    # Address query
    if loc_type == 'address' and components['address']:
        return {
            'SingleLine': f"{components['address']}, St Louis, MO",
            'category': 'Address'
        }
    
    # Block query - use block number as house number
    if loc_type == 'block' and components['block_number'] and components['street1']:
        block_start = int(components['block_number'])
        block_mid = block_start + 50
        return {
            'SingleLine': f"{block_mid} {components['street1']}, St Louis, MO",
            'category': 'Address'
        }
    
    # Between query - just use main street
    if loc_type == 'between' and components['street1']:
        return {
            'SingleLine': f"{components['street1']}, St Louis, MO",
            'category': 'Address'
        }
    
    # Intersection query
    if loc_type == 'intersection' and components['street1'] and components['street2']:
        # Special case: If street2 is a parking lot description, extract the landmark
        if 'PARKING LOT' in components['street2'].upper():
            # Try to extract the landmark name (e.g., "UNION STATION")
            landmark_match = re.search(r'PARKING LOT AT (.+?)(?:\s+EXIT)?$', components['street2'], re.IGNORECASE)
            if landmark_match:
                landmark = landmark_match.group(1).strip()
                # Geocode to the landmark location
                return {
                    'SingleLine': f"{landmark}, St Louis, MO",
                    'category': 'POI,Address'
                }
        
        # Regular intersection
        return {
            'SingleLine': f"{components['street1']} & {components['street2']}, St Louis, MO",
            'category': 'Street Address,Address'
        }
    
    # Fallback to just street1
    if components['street1'] and len(components['street1']) > 3:
        return {
            'SingleLine': f"{components['street1']}, St Louis, MO",
            'category': 'Address'
        }
    
    return None

def geocode_with_esri(query_params):
    """Geocode using ESRI ArcGIS World Geocoding Service"""
    if not query_params:
        return None
    
    params = {
        'f': 'json',
        'token': ESRI_API_KEY,
        'outFields': 'Match_addr,Addr_type,Score',
        'maxLocations': 1,
        'forStorage': False,
        'location': '-90.1994,38.6270',
        'searchExtent': '-90.5,38.5,-90.0,38.85'
    }
    
    if (params['token'] == ''): 
        raise ValueError("The environment value ESRI_API_KEY has not been set.")
        
    params.update(query_params)
    
    try:
        response = requests.get(ESRI_GEOCODE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data.get('candidates') and len(data['candidates']) > 0:
            candidate = data['candidates'][0]
            location = candidate.get('location', {})
            
            lon = location.get('x')
            lat = location.get('y')
            score = candidate.get('score', 0)
            matched_address = candidate.get('address', '')
            addr_type = candidate.get('attributes', {}).get('Addr_type', '')
            
            if score >= 90:
                confidence = 'high'
            elif score >= 75:
                confidence = 'medium'
            else:
                confidence = 'low'
            
            return {
                'lat': lat,
                'lon': lon,
                'confidence': confidence,
                'matched_address': matched_address,
                'score': score,
                'addr_type': addr_type
            }
        else:
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"ESRI API Error: {e}")
        return None

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file not found: {INPUT_FILE}")
        sys.exit(1)
    
    print(f"Loading crash data from {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)

    print(f"Loaded {len(df)} records\n")

    # Add geocoding columns
    df['location_type'] = None
    df['parsed_street1'] = None
    df['parsed_street2'] = None
    df['latitude'] = None
    df['longitude'] = None
    df['geocode_query'] = None
    df['geocode_confidence'] = None
    df['matched_address'] = None
    df['esri_score'] = None
    
    successful = 0
    failed = 0
    
    print("Starting geocoding with ESRI ArcGIS...\n")
    
    for idx, row in df.iterrows():
        on_street = row.get('On Street', '')
        at_street = row.get('At Street', '')
        
        components = parse_location_components(on_street, at_street)
        df.at[idx, 'location_type'] = components['location_type']
        df.at[idx, 'parsed_street1'] = components['street1']
        df.at[idx, 'parsed_street2'] = components['street2']
        
        query_params = build_esri_query(components)
        
        if not query_params:
            failed += 1
            continue
        
        df.at[idx, 'geocode_query'] = query_params.get('SingleLine', '')
        
        result = geocode_with_esri(query_params)
        
        if result:
            df.at[idx, 'latitude'] = result['lat']
            df.at[idx, 'longitude'] = result['lon']
            df.at[idx, 'geocode_confidence'] = result['confidence']
            df.at[idx, 'matched_address'] = result['matched_address']
            df.at[idx, 'esri_score'] = result['score']
            successful += 1
        else:
            failed += 1
        
        if (idx + 1) % 50 == 0:
            print(f"Progress: {idx + 1}/{len(df)} - {successful} geocoded, {failed} failed")
            sleep(0.05)
        
        if (idx + 1) % 100 == 0:
            sleep(1)
    
    print(f"\nSaving results to {OUTPUT_FILE}...")
    df.to_csv(OUTPUT_FILE, index=False)
    
    print(f"\n{'='*60}")
    print(f"GEOCODING SUMMARY")
    print(f"{'='*60}")
    print(f"Total records: {len(df)}")
    print(f"Successfully geocoded: {successful}")
    print(f"Failed: {failed}")
    print(f"Success rate: {successful/len(df)*100:.1f}%")
    print(f"\n✓ Geocoding complete")

if __name__ == "__main__":
    main()